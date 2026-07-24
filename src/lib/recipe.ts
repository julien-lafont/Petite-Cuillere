/**
 * Compose un pas-à-pas de cuisine à partir des aliments d'un repas et de l'âge
 * du bébé. Objectif : simple et efficace, avec un cuiseur-mixeur type Babycook —
 * pas de gastronomie (cf. docs/ux-redesign.md §5).
 *
 * Principe : on regroupe les gestes par nature plutôt que de dérouler chaque
 * aliment isolément, pour que le parent enchaîne sans réfléchir :
 *   1. préparer (éplucher/couper) tout ce qui se cuit
 *   2. une seule cuisson vapeur, calée sur l'aliment le plus long
 *   3. mixer à la texture de l'âge
 *   4. ajouter les matières grasses / laitages hors cuisson
 */

import { portionFor, type Portion } from "@/lib/portions";
import type { MealItem } from "@/lib/data/meals.types";

export type RecipeStep = {
  text: string;
  /** Minutes, si l'étape est une cuisson — pour un éventuel minuteur. */
  minutes?: number;
};

export type MealFoodLine = {
  id: string;
  name: string;
  category: string | null;
  isAllergen: boolean;
  portion: Portion;
};

export type ComposedRecipe = {
  lines: MealFoodLine[];
  steps: RecipeStep[];
  /** Vrai si le repas comporte au moins un aliment à cuire. */
  hasCooking: boolean;
};

/** Texture cible selon l'âge projeté (mois), cf. guide de diversification §5. */
export function textureForAge(months: number): string {
  if (months < 8) return "purée bien lisse";
  if (months < 10) return "écrasé à la fourchette";
  return "petits morceaux fondants";
}

type RecipeFood = NonNullable<MealItem["food"]>;

function isFat(category: string | null): boolean {
  return category === "matière grasse";
}

function isRaw(food: RecipeFood): boolean {
  // cook_minutes à 0 = aucune cuisson (banane, laitage, pain, huile…).
  return (food.cook_minutes ?? 0) === 0;
}

/**
 * Construit la recette d'un repas. `months` pilote les quantités et la texture.
 */
export function composeRecipe(items: MealItem[], months: number): ComposedRecipe {
  const foods = items
    .map((it) => it.food)
    .filter((f): f is RecipeFood => f !== null);

  const lines: MealFoodLine[] = foods.map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category,
    isAllergen: f.is_allergen,
    portion: portionFor(f.category, months),
  }));

  // Aliments à cuire (hors matières grasses, qui s'ajoutent toujours crues).
  const toCook = foods.filter((f) => !isRaw(f) && !isFat(f.category));
  const fats = foods.filter((f) => isFat(f.category));
  const rawFoods = foods.filter((f) => isRaw(f) && !isFat(f.category));

  const steps: RecipeStep[] = [];

  // 1. Préparation préalable de chaque aliment à cuire.
  for (const f of toCook) {
    if (f.prep_note) steps.push({ text: `${f.name} : ${lower(f.prep_note)}.` });
  }

  // 2. Cuisson vapeur unique, calée sur le temps le plus long.
  if (toCook.length > 0) {
    const maxMinutes = Math.max(...toCook.map((f) => f.cook_minutes ?? 0));
    const names = joinNames(toCook.map((f) => f.name));
    steps.push({
      text:
        toCook.length === 1
          ? `Cuis à la vapeur ${maxMinutes} min, jusqu'à ce que ce soit bien tendre.`
          : `Mets ${names} à cuire ensemble à la vapeur ${maxMinutes} min.`,
      minutes: maxMinutes,
    });
  }

  // 3. Mixage à la texture de l'âge.
  if (toCook.length > 0) {
    steps.push({
      text: `Mixe en ${textureForAge(months)}, en ajoutant un peu d'eau de cuisson si besoin.`,
    });
  }

  // 4. Aliments crus (banane écrasée, laitage…) traités à part.
  for (const f of rawFoods) {
    if (f.prep_note) steps.push({ text: `${f.name} : ${lower(f.prep_note)}.` });
  }

  // 5. Matières grasses, toujours en dernier, hors cuisson.
  if (fats.length > 0) {
    const names = joinNames(fats.map((f) => f.name.toLowerCase()));
    steps.push({
      text: `Ajoute ${portionLabelFor(fats)} de ${names}, hors du feu.`,
    });
  }

  return { lines, steps, hasCooking: toCook.length > 0 };
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

function portionLabelFor(fats: RecipeFood[]): string {
  return fats.length === 1 ? "1 c. à café" : `${fats.length} c. à café`;
}
