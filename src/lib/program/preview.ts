/**
 * Programme preview **without an account** (see docs/ux-redesign.md §3.5,
 * decision D3).
 *
 * Everything is computed in memory, on the client: `buildPlan` is pure logic,
 * and the common catalogue is readable while signed out. Nothing is written to
 * the database until the parent creates an account — a visitor leaves no trace.
 *
 * The resulting plan is then "hydrated" (ids → full foods) so the same
 * components as the signed-in app can render it.
 */

import { buildPlan, type PlanFood } from "@/lib/program/plan";
import { addDays, toISODate } from "@/lib/dates";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";
import type { MealWithDetails } from "@/lib/data/meals.types";
import type { BabySetup } from "@/lib/data/baby.actions";

/** Default meal moments, identical to those created for a new household. */
export const DEFAULT_MOMENTS = [
  { id: "preview-petit-dej", label: "Petit-déjeuner" },
  { id: "preview-dejeuner", label: "Déjeuner" },
  { id: "preview-gouter", label: "Goûter" },
  { id: "preview-diner", label: "Dîner" },
] as const;

/** How much of the programme is previewed without an account: the first month. */
export const PREVIEW_DAYS = 31;

export type PreviewDay = {
  dateISO: string;
  meals: MealWithDetails[];
};

export type Preview = {
  days: PreviewDay[];
  /** Foods treated as already known (catch-up) — to flag what is new. */
  introducedIds: string[];
};

/** Projects a catalogue food into the shape the meal components expect. */
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
    dose_only: f.dose_only,
    portion_label: f.portion_label,
    portion_grams: f.portion_grams,
    restrictions: f.restrictions,
    season: f.season,
  };
}

/**
 * Builds the programme preview from the onboarding answers. Never touches the
 * database: the result only exists in memory.
 */
export function buildPreview(
  setup: BabySetup,
  foods: FoodRow[],
  allergens: AllergenRow[],
): Preview {
  const planFoods: PlanFood[] = foods.map((f) => ({
    id: f.id,
    category: f.category,
    dose_only: f.dose_only,
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

  // Group the planned meals by day.
  const byDate = new Map<string, MealWithDetails[]>();
  for (const pm of plan.meals) {
    const meal: MealWithDetails = {
      id: `${pm.date}|${pm.momentId}`,
      baby_id: "preview",
      date: pm.date,
      meal_moment_id: pm.momentId,
      result: null,
      note: null,
      // The preview is a projection: it has no real history to carry.
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

  // One entry per day of the period, even with no meal (milk-only days).
  const start = new Date(setup.startISO);
  const days: PreviewDay[] = Array.from({ length: PREVIEW_DAYS }, (_, i) => {
    const dateISO = toISODate(addDays(start, i));
    return { dateISO, meals: byDate.get(dateISO) ?? [] };
  });

  return { days, introducedIds: setup.tastedFoodIds };
}

/** Orders a day's meals by the default moment order. */
export function momentLabel(momentId: string | null): string {
  return DEFAULT_MOMENTS.find((m) => m.id === momentId)?.label ?? "Repas";
}

export function momentRank(momentId: string | null): number {
  const i = DEFAULT_MOMENTS.findIndex((m) => m.id === momentId);
  return i === -1 ? 99 : i;
}
