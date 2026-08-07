/**
 * Aperçu du programme **sans compte** (cf. docs/ux-redesign.md §3.5, décision D3).
 *
 * Tout est calculé en mémoire, côté client : `buildPlan` est une logique pure, et
 * le catalogue commun est lisible sans être connecté. Rien n'est écrit en base
 * tant que le parent n'a pas créé son compte — un visiteur ne laisse aucune trace.
 *
 * Le plan produit est ensuite « hydraté » (identifiants → aliments complets) pour
 * être rendu par les mêmes composants que l'app connectée.
 */

import { buildPlan, type PlanFood } from "@/lib/program/plan";
import { addDays, toISODate } from "@/lib/dates";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";
import type { MealWithDetails } from "@/lib/data/meals.types";
import type { BabySetup } from "@/lib/data/baby.actions";

/** Moments de repas par défaut, identiques à ceux créés pour un nouveau foyer. */
export const DEFAULT_MOMENTS = [
  { id: "preview-petit-dej", label: "Petit-déjeuner" },
  { id: "preview-dejeuner", label: "Déjeuner" },
  { id: "preview-gouter", label: "Goûter" },
  { id: "preview-diner", label: "Dîner" },
] as const;

/** Durée de l'aperçu offert sans compte : le premier mois. */
export const PREVIEW_DAYS = 31;

export type PreviewDay = {
  dateISO: string;
  meals: MealWithDetails[];
};

export type Preview = {
  days: PreviewDay[];
  /** Aliments considérés comme déjà connus (rattrapage) — pour marquer les nouveautés. */
  introducedIds: string[];
};

/** Projette un aliment du catalogue dans la forme attendue par les composants de repas. */
function toMealFood(f: FoodRow) {
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    is_allergen: f.is_allergen,
    allergen_type: f.allergen_type,
    texture: f.texture,
    preparation: f.preparation,
    quantite_indicative: f.quantite_indicative,
    cook_minutes: f.cook_minutes,
    prep_note: f.prep_note,
    cook_method: f.cook_method,
    course: f.course,
    served_apart: f.served_apart,
    restrictions: f.restrictions,
    season: f.season,
  };
}

/**
 * Construit l'aperçu du programme à partir des réponses de l'onboarding.
 * Ne touche jamais la base : le résultat n'existe qu'en mémoire.
 */
export function buildPreview(
  setup: BabySetup,
  foods: FoodRow[],
  allergens: AllergenRow[],
): Preview {
  const planFoods: PlanFood[] = foods.map((f) => ({
    id: f.id,
    category: f.category,
    age_introduction_min: f.age_introduction_min,
    is_allergen: f.is_allergen,
    allergen_type: f.allergen_type,
    allergen_id: f.allergen_id,
    intro_order: f.intro_order,
  }));

  const plan = buildPlan({
    birth: new Date(setup.dateNaissance),
    due: null,
    ageRef: null,
    startISO: setup.startISO,
    days: PREVIEW_DAYS,
    moments: DEFAULT_MOMENTS.map((m) => ({ id: m.id, label: m.label })),
    diversificationStartedOn: setup.diversificationStartedOn ?? null,
    atopicRisk: setup.atopicRisk ?? false,
    foods: planFoods,
    allergens,
    alreadyIntroduced: setup.tastedFoodIds,
  });

  const foodById = new Map(foods.map((f) => [f.id, f]));
  const allergenById = new Map(allergens.map((a) => [a.id, a]));

  // Regroupement des repas planifiés par jour.
  const byDate = new Map<string, MealWithDetails[]>();
  for (const pm of plan.meals) {
    const meal: MealWithDetails = {
      id: `${pm.date}|${pm.momentId}`,
      baby_id: "preview",
      date: pm.date,
      meal_moment_id: pm.momentId,
      result: null,
      note: null,
      // L'aperçu est une projection : il n'a pas d'histoire réelle à porter.
      status: "prevu",
      logged_at: null,
      created_at: new Date().toISOString(),
      locked: false,
      planned_food_ids: null,
      meal_items: pm.items.flatMap((it) => {
        const f = foodById.get(it.foodId);
        return f
          ? [
              {
                id: `${pm.date}-${it.foodId}`,
                dose: it.dose,
                source: "programme" as const,
                skipped: false,
                food: toMealFood(f),
              },
            ]
          : [];
      }),
      meal_allergens: pm.allergenIds.flatMap((id) => {
        const a = allergenById.get(id);
        return a
          ? [{ id: `${pm.date}-${id}`, allergen: { id: a.id, name: a.name } }]
          : [];
      }),
      intake_observations: [],
    };
    const list = byDate.get(pm.date) ?? [];
    list.push(meal);
    byDate.set(pm.date, list);
  }

  // Une entrée par jour de la période, même sans repas (jours « tout au lait »).
  const start = new Date(setup.startISO);
  const days: PreviewDay[] = Array.from({ length: PREVIEW_DAYS }, (_, i) => {
    const dateISO = toISODate(addDays(start, i));
    return { dateISO, meals: byDate.get(dateISO) ?? [] };
  });

  return { days, introducedIds: setup.tastedFoodIds };
}

/** Ordonne les repas d'un jour selon l'ordre des moments par défaut. */
export function momentLabel(momentId: string | null): string {
  return DEFAULT_MOMENTS.find((m) => m.id === momentId)?.label ?? "Repas";
}

export function momentRank(momentId: string | null): number {
  const i = DEFAULT_MOMENTS.findIndex((m) => m.id === momentId);
  return i === -1 ? 99 : i;
}
