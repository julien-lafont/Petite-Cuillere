import { getAgeInfo } from "@/lib/age";
import { getAllergenIntroductions, getAllergens } from "@/lib/data/allergens";
import { getBabies, pickActiveBaby, type BabyRow } from "@/lib/data/baby";
import { getFoods } from "@/lib/data/foods";
import { getFoodStats } from "@/lib/data/food-stats";
import { getMealMoments } from "@/lib/data/meal-moments";
import { getMealsBetween } from "@/lib/data/meals";
import { getShoppingChecks } from "@/lib/data/shopping";
import { addDays, startOfWeek, toISODate } from "@/lib/dates";
import type { VoiceContext } from "@/lib/voice/types";

/**
 * Le chargement du contexte, depuis la base de ce foyer-là.
 *
 * Tout passe par les fonctions de lecture existantes, donc par la RLS : la
 * commande vocale n'ouvre aucune porte, elle emprunte celles qui existent.
 *
 * Fenêtre volontairement étroite — J-2 à J+7 (§4.6). Deux jours en arrière
 * couvrent le rattrapage, sept en avant couvrent la semaine que le parent a
 * sous les yeux ; au-delà, on gonflerait le prompt pour des phrases que
 * personne ne prononce.
 */

const DAYS_BACK = 2;
const DAYS_AHEAD = 7;

export type LoadedVoiceContext = {
  ctx: VoiceContext;
  babies: BabyRow[];
  active: BabyRow;
};

export async function loadVoiceContext(
  activeBabyId: string | undefined,
  now: Date = new Date(),
): Promise<LoadedVoiceContext | null> {
  const babies = await getBabies();
  const active = pickActiveBaby(babies, activeBabyId);
  if (!active) return null;

  const today = toISODate(now);
  const from = toISODate(addDays(now, -DAYS_BACK));
  const to = toISODate(addDays(now, DAYS_AHEAD));

  const [moments, foods, meals, stats, allergens, exposures, shopping] =
    await Promise.all([
      getMealMoments(),
      getFoods(),
      getMealsBetween(active.id, from, to),
      getFoodStats(active.id, today),
      getAllergens(),
      getAllergenIntroductions(active.id),
      getShoppingChecks(toISODate(startOfWeek(now))),
    ]);

  const foodNameById = new Map(foods.map((f) => [f.id, f.name]));
  const allergenNameById = new Map(allergens.map((a) => [a.id, a.name]));

  const babyContexts = babies.map((baby) => {
    const age = getAgeInfo(
      new Date(baby.date_naissance),
      baby.date_terme ? new Date(baby.date_terme) : null,
      baby.age_reference_date ? new Date(baby.age_reference_date) : null,
    );
    return {
      id: baby.id,
      firstName: baby.prenom,
      sexe: baby.sexe,
      ageLabel: age.effective,
      ageMonths: age.effectiveMonths,
      active: baby.id === active.id,
    };
  });

  const discovered: { name: string; exposures: number }[] = [];
  for (const [id, stat] of stats) {
    const name = foodNameById.get(id);
    if (name && stat.exposures > 0) {
      discovered.push({ name, exposures: stat.exposures });
    }
  }
  discovered.sort((a, b) => b.exposures - a.exposures);

  // Un allergène est « en cours » dès qu'une exposition a été enregistrée, et
  // « prévu » tant que rien n'a eu lieu. La finesse du protocole appartient au
  // lot 4 — ici on situe, on ne conclut pas.
  const allergenStates = exposures.map((exposure) => ({
    name: allergenNameById.get(exposure.allergen_id) ?? "?",
    state: exposure.had_reaction
      ? ("confirmed" as const)
      : exposure.first_tried_on && exposure.first_tried_on <= today
        ? ("ongoing" as const)
        : ("planned" as const),
    date: exposure.first_tried_on,
  }));

  const checked = new Set(shopping.foodIds);
  const onMenu = new Set(
    meals
      .filter((meal) => meal.date >= today)
      .flatMap((meal) => meal.meal_items.map((item) => item.food?.id))
      .filter((id): id is string => Boolean(id)),
  );

  const ctx: VoiceContext = {
    now: `${today}T${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}`,
    today,
    weekday: new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(now),
    babies: babyContexts,
    moments: moments.map((moment) => ({
      id: moment.id,
      label: moment.label,
      position: moment.position,
    })),
    foods: foods.map((food) => ({
      id: food.id,
      name: food.name,
      category: food.category,
      minAgeMonths: food.age_introduction_min,
      restrictions: food.restrictions,
      allergen: food.allergen_id
        ? (allergenNameById.get(food.allergen_id) ?? null)
        : null,
    })),
    meals: meals
      .filter((meal) => meal.meal_moment_id)
      .map((meal) => ({
        date: meal.date,
        momentId: meal.meal_moment_id!,
        foods: meal.meal_items
          .map((item) => item.food?.name)
          .filter((name): name is string => Boolean(name)),
        status: meal.status,
        result: meal.result,
      })),
    discovered,
    allergens: allergenStates,
    shopping: [...onMenu].map((id) => ({
      name: foodNameById.get(id) ?? "?",
      checked: checked.has(id),
    })),
  };

  return { ctx, babies, active };
}
