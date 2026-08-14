import type { MealWithDetails } from "@/lib/data/meals.types";

/**
 * Reads a meal's selection — its foods and allergens — in the shape the forms
 * expect.
 *
 * Extracted from the plan and log dialogs: both start from this selection on
 * open and compare it against the parent's to know whether anything is left to
 * save.
 */
export function mealFoodIds(meal: MealWithDetails | null): Set<string> {
  return new Set(
    (meal?.meal_items ?? [])
      .map((i) => i.food?.id)
      .filter((x): x is string => !!x),
  );
}

export function mealAllergenIds(meal: MealWithDetails | null): Set<string> {
  return new Set(
    (meal?.meal_allergens ?? [])
      .map((x) => x.allergen?.id)
      .filter((x): x is string => !!x),
  );
}

/**
 * Comparable fingerprint of a selection. Ids are sorted: two identical
 * selections ticked in a different order must produce the same string, or the
 * save button would light up for nothing.
 */
export function selectionSignature(
  foodIds: Set<string>,
  allergenIds: Set<string>,
): string {
  return JSON.stringify([[...foodIds].sort(), [...allergenIds].sort()]);
}
