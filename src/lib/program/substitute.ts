/**
 * "I don't have that" — picking the substitutes. PURE LOGIC.
 * See docs/feats/suivi-reel-et-rattrapage.md §4.2.
 *
 * Half the deviations are decided in front of the fridge, not after the meal.
 * Offering three substitutes right away turns a silent abandonment into clean
 * data — and helps the parent within the second. It is the highest-return
 * gesture in the whole feature.
 *
 * Criteria, in this order:
 *   1. **same category** — a vegetable replaces a vegetable, or the meal loses
 *      its balance and the programme its point;
 *   2. **already known to the child** — a substitution is no time for a
 *      discovery: that deserves its own day, repetition and attention;
 *   3. **least served recently** — we take the chance to vary.
 */

import { slotGroupOf } from "@/lib/categories";

export type SubstituteFood = {
  id: string;
  name: string;
  category: string | null;
  age_introduction_min: number | null;
};

/** Nombre de remplaçants proposés. Trois : de quoi choisir, pas de quoi hésiter. */
export const SUBSTITUTE_COUNT = 3;

export function findSubstitutes<T extends SubstituteFood>(
  target: SubstituteFood,
  foods: T[],
  options: {
    /** Foods the child already knows. */
    introducedIds: Set<string>;
    /** Recent occurrences per food — to serve the least-seen first. */
    usage?: Record<string, number>;
    /** The child's projected age on the meal's date. */
    ageMonths: number;
    /** Foods already on this meal's menu: do not offer them twice. */
    exclude?: Set<string>;
  },
): T[] {
  const { introducedIds, usage = {}, ageMonths, exclude } = options;

  // "Same category" means the same place in the meal, not the same shop aisle:
  // someone out of rice is offered pasta, but also potato. Categories with no
  // slot (fats, nut butters, condiments) have no such shared fallback — an oil
  // is not replaced by almond butter — so they are compared with their own kind
  // only.
  const group = slotGroupOf(target.category);
  const sameKind = (f: SubstituteFood) =>
    group === null
      ? f.category === target.category
      : slotGroupOf(f.category) === group;

  const candidates = foods.filter(
    (f) =>
      f.id !== target.id &&
      sameKind(f) &&
      (f.age_introduction_min ?? 0) <= ageMonths &&
      !exclude?.has(f.id),
  );

  // Known foods first — but if the child knows none in this category (the very
  // start of diversification), a new food beats offering nothing at all.
  const known = candidates.filter((f) => introducedIds.has(f.id));
  const pool = known.length > 0 ? known : candidates;

  return [...pool]
    .sort(
      (a, b) =>
        (usage[a.id] ?? 0) - (usage[b.id] ?? 0) ||
        a.name.localeCompare(b.name, "fr"),
    )
    .slice(0, SUBSTITUTE_COUNT);
}
