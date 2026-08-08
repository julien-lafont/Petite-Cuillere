import type { MealWithDetails } from "@/lib/data/meals.types";

/**
 * Lecture de la sélection d'un repas — les aliments et les allergènes qui y sont
 * rattachés — sous la forme qu'attendent les formulaires.
 *
 * Extrait des dialogues « planifier » et « noter » : tous deux repartent de cette
 * même sélection à l'ouverture, et la comparent à celle du parent pour savoir
 * s'il reste quelque chose à enregistrer.
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
 * Empreinte comparable d'une sélection. Les identifiants sont triés : deux
 * sélections identiques cochées dans un ordre différent doivent donner la même
 * chaîne, sans quoi le bouton « Enregistrer » s'activerait pour rien.
 */
export function selectionSignature(
  foodIds: Set<string>,
  allergenIds: Set<string>,
): string {
  return JSON.stringify([[...foodIds].sort(), [...allergenIds].sort()]);
}
