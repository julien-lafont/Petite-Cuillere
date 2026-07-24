/** Types et helpers purs des repas — utilisables côté client comme serveur. */

export type MealResult = "bien" | "moyen" | "refuse" | null;

export type MealItem = {
  id: string;
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
  meal_items: MealItem[];
  meal_allergens: MealAllergenLink[];
  intake_observations: Observation[];
};

/** Brouillon d'un repas édité localement, persisté d'un coup via `saveMeal`. */
export type MealObservationDraft = {
  effect_type: string;
  severity: string;
  note: string;
};
export type MealDraft = {
  result: MealResult;
  note: string;
  foodIds: string[];
  allergenIds: string[];
  observations: MealObservationDraft[];
};

/** Nombre d'introductions par aliment / allergène jusqu'à une date. */
export type IntroductionCounts = {
  foods: Record<string, number>;
  allergens: Record<string, number>;
};

/** Clé de repérage d'un repas dans une grille : date + moment. */
export function mealKey(dateISO: string, momentId: string): string {
  return `${dateISO}|${momentId}`;
}

/** Indexe une liste de repas par (date, moment) pour un accès direct. */
export function indexMeals(
  meals: MealWithDetails[],
): Map<string, MealWithDetails> {
  const map = new Map<string, MealWithDetails>();
  for (const m of meals) {
    if (m.meal_moment_id) map.set(mealKey(m.date, m.meal_moment_id), m);
  }
  return map;
}
