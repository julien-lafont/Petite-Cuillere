/**
 * Indicative quantities per meal, from the baby's projected age and the food
 * category. Answers the central question of the "Aujourd'hui" screen: how much
 * should I prepare? (see docs/ux-redesign.md §5).
 *
 * Reference points (PNNS 4 plus common paediatric practice):
 *   · Vegetables/fruit: ~2-3 teaspoons at the very start (4 months), rising
 *     gradually to ~130 g around 6 months and ~150-200 g beyond, with appetite.
 *   · Protein: ~10 g a day before age 1 ("10 g per year of age"), in one meal.
 *   · Fat: 1 teaspoon a day from the first savoury meal.
 *   · Starches — grains, pulses and tubers: ~¼ of the vegetable portion. Same
 *     reference for all three, only the shop aisle differs.
 *
 * ⚠️ Indicative. We always remind parents to follow the child's appetite: these
 * are not targets to hit.
 */

import type { FoodCategory } from "@/lib/categories";

export type PortionCategory = FoodCategory;

export type Portion = {
  /** Displayable quantity, e.g. "~120 g" or "1 c. à café". */
  label: string;
  /** Estimated grams, to aggregate the shopping list (null when not relevant). */
  grams: number | null;
};

/**
 * The part of the catalogue that may contradict the per-category rule.
 *
 * Some foods do belong to their category without following its quantity: a prune
 * is a dessert, but you do not serve 180 g of it — it is a laxative before it is
 * a compote. The category says *where* a food is eaten, not always *how much*.
 * That portion is a property of the food, so it lives in the catalogue
 * (migration 0021) rather than here.
 */
export type FoodPortion = {
  portion_label: string | null;
  portion_grams: number | null;
};

/**
 * Grams of vegetable or fruit for one meal, from the projected age in months.
 * Deliberately a gentle curve: no jolts from one month to the next.
 */
function vegFruitGrams(months: number): number {
  if (months < 4) return 0;
  if (months < 5) return 60; // first weeks: a few spoonfuls
  if (months < 6) return 120;
  if (months < 8) return 150;
  if (months < 10) return 180;
  return 200;
}

/** Grams of protein: ~10 g before age 1, in a single meal a day. */
function proteinGrams(months: number): number {
  if (months < 5.5) return 0; // no protein at the very beginning
  return 10;
}

/** Kitchen rounding: to the nearest 10 g. */
function roundGrams(g: number): number {
  return Math.round(g / 10) * 10;
}

/**
 * Indicative portion of a food for one meal, from its category and the age.
 * Categories with no useful weight — fat, dairy, bread — get a household label
 * rather than grams.
 *
 * `food` lets a food impose its own portion. It is the last of the three sources
 * of quantity, in decreasing priority: the allergen protocol dose (applied
 * upstream, in `recipe.ts`), then the catalogue portion, then the per-category
 * rule below.
 */
export function portionFor(
  category: PortionCategory | string | null,
  months: number,
  food?: FoodPortion | null,
): Portion {
  if (food?.portion_label) {
    return { label: food.portion_label, grams: food.portion_grams };
  }

  switch (category) {
    case "légume":
    case "fruit": {
      const g = roundGrams(vegFruitGrams(months));
      return g > 0
        ? { label: `~${g} g`, grams: g }
        : { label: "quelques c.", grams: 20 };
    }
    case "protéine": {
      const g = proteinGrams(months);
      return g > 0
        ? { label: `~${g} g (2 c. à café)`, grams: g }
        : { label: "pas encore", grams: null };
    }
    case "féculent":
    case "céréale":
    case "légumineuse": {
      const g = roundGrams(vegFruitGrams(months) / 4);
      return { label: `~${g} g`, grams: g };
    }
    case "matière grasse":
      return { label: "1 c. à café", grams: 5 };
    case "laitier":
      return { label: "1 pot", grams: null };
    default:
      return { label: "petite portion", grams: null };
  }
}
