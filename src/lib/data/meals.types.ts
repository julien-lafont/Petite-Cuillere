/** Pure meal types and helpers — usable on client and server. */

export type MealResult = "bien" | "moyen" | "refuse" | null;

/**
 * What actually happened (see docs/feats/suivi-reel-et-rattrapage.md §3).
 *
 *   prevu    — the programme wrote it, the parent said nothing
 *   servi    — given, composition as planned
 *   remplace — given, but something else
 *   saute    — not given
 */
export type MealStatus = "prevu" | "servi" | "remplace" | "saute";

export type MealItem = {
  id: string;
  /**
   * Prescribed dose, when there is one: allergens follow a ramp-up protocol (a
   * knife tip on the first day, the target dose the next). NULL for an ordinary
   * food, whose quantity follows from the age (`portionFor`).
   */
  dose: string | null;
  /** Who put this food there: the generator, or the parent. */
  source: "programme" | "parent";
  /** This particular food was not given, while the rest of the meal was. */
  skipped: boolean;
  food: {
    id: string;
    name: string;
    category: string | null;
    is_allergen: boolean;
    allergen_type: string | null;
    texture: string | null;
    preparation: string | null;
    quantite_indicative: string | null;
    cook_minutes: number | null;
    prep_note: string | null;
    /** 'vapeur' | 'eau' | 'aucune' — cf. migration 0019 et `lib/recipe.ts`. */
    cook_method: string | null;
    /** 'salé' | 'sucré' — host preparation; null = served on its own. */
    course: string | null;
    /** Served as is, never blended (dairy, a crust of bread). */
    served_apart: boolean | null;
    /** Dose laid on the meal without taking a place in it — see migration 0023. */
    dose_only: boolean | null;
    /** Portion specific to the food, when the category does not say the quantity. */
    portion_label: string | null;
    portion_grams: number | null;
    restrictions: string | null;
    season: number[][] | null;
  } | null;
};

export type MealAllergenLink = {
  id: string;
  allergen: { id: string; name: string } | null;
};

export type Observation = {
  id: string;
  effect_type: string | null;
  severity: string | null;
  delay: string | null;
  note: string | null;
  allergen_id: string | null;
  food_id: string | null;
};

export type MealWithDetails = {
  id: string;
  baby_id: string;
  date: string;
  meal_moment_id: string | null;
  result: MealResult;
  note: string | null;
  status: MealStatus;
  logged_at: string | null;
  /** When the row was written. Replanning renews it: that is what lets us say
   *  "this entered the programme after your shopping trip". */
  created_at: string;
  /** Meal fixed by the parent: the engine never rewrites it. */
  locked: boolean;
  /** What the programme had planned before correction — display only. */
  planned_food_ids: string[] | null;
  meal_items: MealItem[];
  meal_allergens: MealAllergenLink[];
  intake_observations: Observation[];
};

/**
 * The parent has spoken about this meal. It is the only proof it happened, and
 * so the only one the allergen protocol will lean on.
 */
export function isConfirmed(meal: { status: MealStatus }): boolean {
  return meal.status === "servi" || meal.status === "remplace";
}

/**
 * Does this meal count as an exposure to the foods it carries?
 *
 * Everything but "skipped": a past meal with no signal is **presumed eaten**.
 * Being wrong costs little (the food comes back in the rotation), whereas
 * stalling the programme on a silent parent would cost the whole product. The
 * reverse asymmetry only holds for allergens — see `isConfirmed`.
 */
export function countsAsExposure(meal: { status: MealStatus }): boolean {
  return meal.status !== "saute";
}

/** Foods actually eaten: the un-unticked items of a meal that was not skipped. */
export function servedFoodIds(meal: {
  status: MealStatus;
  meal_items: { skipped: boolean; food: { id: string } | null }[];
}): string[] {
  if (!countsAsExposure(meal)) return [];
  return meal.meal_items
    .filter((it) => !it.skipped && it.food)
    .map((it) => it.food!.id);
}

/*
 * "Is this meal behind us?" is no longer answered here.
 *
 * The question needs the clock: it lives in `lib/moments.ts` — `isPastMeal` and
 * `awaitsSignalAt` — with the time slots, which alone can answer it.
 */

/** Draft of a meal edited locally, persisted in one go through `saveMeal`. */
export type MealObservationDraft = {
  effect_type: string;
  severity: string;
  note: string;
};
/**
 * What the parent is doing. Decides whether saving is a plan (which we lock) or
 * a report (which sets a real status).
 */
export type MealIntent = "plan" | "log" | "evaluate";

export type MealDraft = {
  result: MealResult;
  note: string;
  foodIds: string[];
  allergenIds: string[];
  observations: MealObservationDraft[];
  intent?: MealIntent;
};

/** Number of introductions per food / allergen up to a date. */
export type IntroductionCounts = {
  foods: Record<string, number>;
  allergens: Record<string, number>;
};

/** Key locating a meal in a grid: date + moment. */
export function mealKey(dateISO: string, momentId: string): string {
  return `${dateISO}|${momentId}`;
}

/** Indexes a meal list by (date, moment) for direct access. */
export function indexMeals(
  meals: MealWithDetails[],
): Map<string, MealWithDetails> {
  const map = new Map<string, MealWithDetails>();
  for (const m of meals) {
    if (m.meal_moment_id) map.set(mealKey(m.date, m.meal_moment_id), m);
  }
  return map;
}
