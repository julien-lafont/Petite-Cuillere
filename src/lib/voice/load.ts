import { getAgeInfo } from "@/lib/age";
import { getAllergenIntroductions, getAllergens } from "@/lib/data/allergens";
import { getBabies, pickActiveBaby, type BabyRow } from "@/lib/data/baby";
import { getFoods } from "@/lib/data/foods";
import { getFoodStats } from "@/lib/data/food-stats";
import { getMealMoments } from "@/lib/data/meal-moments";
import { getMealsBetween } from "@/lib/data/meals";
import { getShoppingChecks } from "@/lib/data/shopping";
import { getHouseholdTimeZone } from "@/lib/data/household";
import { nowIn, addISODays } from "@/lib/clock";
import { startOfWeek, toISODate } from "@/lib/dates";
import { isPastMeal } from "@/lib/moments";
import type { VoiceContext } from "@/lib/voice/types";

/**
 * Loading the context, from that household's database.
 *
 * Everything goes through the existing read functions, so through RLS: voice
 * commands open no door, they use the ones that exist.
 *
 * A deliberately narrow window — D-2 to D+7 (§4.6). Two days back cover
 * catch-up, seven ahead cover the week the parent has in front of them; beyond
 * that we would inflate the prompt for sentences nobody says.
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
  at: Date = new Date(),
): Promise<LoadedVoiceContext | null> {
  const babies = await getBabies();
  const active = pickActiveBaby(babies, activeBabyId);
  if (!active) return null;

  // The time comes from the household, never from the server: it decides
  // whether "il a mangé" means lunch or the snack (docs/feats/creneaux-horaires.md §3.2).
  const now = nowIn(await getHouseholdTimeZone(), at);
  const today = now.todayISO;
  const from = addISODays(today, -DAYS_BACK);
  const to = addISODays(today, DAYS_AHEAD);

  const moments = await getMealMoments();
  const [foods, meals, stats, allergens, exposures, shopping] =
    await Promise.all([
      getFoods(),
      getMealsBetween(active.id, from, to),
      getFoodStats(active.id, now, moments),
      getAllergens(),
      getAllergenIntroductions(active.id),
      getShoppingChecks(toISODate(startOfWeek(new Date(`${today}T12:00:00`)))),
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

  // An allergen is "in progress" as soon as an exposure has been recorded, and
  // "planned" while nothing has happened. The protocol's detail belongs to batch
  // 4 — here we place, we do not conclude.
  const allergenStates = exposures.map((exposure) => ({
    name: allergenNameById.get(exposure.allergen_id) ?? "?",
    state: exposure.had_reaction
      ? ("confirmed" as const)
      : exposure.first_tried_on && exposure.first_tried_on <= today
        ? ("ongoing" as const)
        : ("planned" as const),
    date: exposure.first_tried_on,
  }));

  const momentById = new Map(moments.map((moment) => [moment.id, moment]));

  const checked = new Set(shopping.foodIds);
  const onMenu = new Set(
    meals
      .filter(
        (meal) =>
          !isPastMeal(
            meal,
            meal.meal_moment_id ? momentById.get(meal.meal_moment_id) : null,
            now,
          ),
      )
      .flatMap((meal) => meal.meal_items.map((item) => item.food?.id))
      .filter((id): id is string => Boolean(id)),
  );

  const pad = (value: number) => String(value).padStart(2, "0");
  const ctx: VoiceContext = {
    now: `${today}T${pad(Math.floor(now.minutes / 60))}:${pad(now.minutes % 60)}`,
    nowMinutes: now.minutes,
    today,
    weekday: new Intl.DateTimeFormat("fr-FR", { weekday: "long" }).format(
      new Date(`${today}T12:00:00`),
    ),
    babies: babyContexts,
    moments: moments.map((moment) => ({
      id: moment.id,
      label: moment.label,
      position: moment.position,
      startMinute: moment.startMinute,
      endMinute: moment.endMinute,
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
