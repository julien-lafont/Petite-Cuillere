/**
 * What replanning changed, and how to say it — PURE LOGIC.
 * See docs/feats/suivi-reel-et-rattrapage.md §4.6 and §7.3.
 *
 * The parent must understand that the programme is alive, without guessing it or
 * comparing two screens. Hence a short, factual sentence, never a tally: we say
 * what happens tomorrow, not how many days moved.
 *
 * Non-negotiable writing rule (D8): no vocabulary of shortfall, failure or
 * catching up. "On a ajusté", never "vous n'avez pas suivi".
 */

/** A meal, cut down to what the comparison looks at. */
export type ComparableMeal = {
  date: string;
  momentId: string;
  foodIds: string[];
};

export type PlanDiff = {
  /** Number of days with at least one meal changing. */
  changedDays: number;
  /** Food offered again as soon as tomorrow under the two-day rule (R2). */
  repeatedFood?: string;
  /** Foods entering the programme that were not in it. */
  addedFoods: string[];
  /** Foods leaving it. */
  removedFoods: string[];
};

const key = (m: { date: string; momentId: string }) =>
  `${m.date}|${m.momentId}`;

/** Two identical compositions, order aside. */
export function sameComposition(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

/**
 * Compares the old programme to the new one, over the replanned period.
 * `nameOf` produces readable labels; an unknown id is simply skipped, so a UUID
 * is never shown to the parent.
 */
export function comparePlans(
  before: ComparableMeal[],
  after: ComparableMeal[],
  nameOf: (foodId: string) => string | null,
): PlanDiff {
  const beforeByKey = new Map(before.map((m) => [key(m), m.foodIds]));
  const afterByKey = new Map(after.map((m) => [key(m), m.foodIds]));

  const changedDates = new Set<string>();
  const added = new Set<string>();
  const removed = new Set<string>();

  for (const [k, foodIds] of afterByKey) {
    const previous = beforeByKey.get(k);
    if (previous && sameComposition(previous, foodIds)) continue;
    changedDates.add(k.slice(0, k.indexOf("|")));
    for (const id of foodIds) if (!previous?.includes(id)) added.add(id);
  }
  for (const [k, foodIds] of beforeByKey) {
    const next = afterByKey.get(k);
    if (next && sameComposition(next, foodIds)) continue;
    changedDates.add(k.slice(0, k.indexOf("|")));
    for (const id of foodIds) if (!next?.includes(id)) removed.add(id);
  }

  const names = (ids: Set<string>) =>
    [...ids]
      .map(nameOf)
      .filter((n): n is string => !!n)
      .sort((a, b) => a.localeCompare(b, "fr"));

  return {
    changedDays: changedDates.size,
    addedFoods: names(added),
    removedFoods: names(removed),
  };
}

/**
 * The sentence shown to the parent after a signal. `null` when nothing moved:
 * better to say nothing than to announce a phantom adjustment.
 */
export function diffSentence(diff: PlanDiff): string | null {
  if (diff.repeatedFood) {
    const suite =
      diff.changedDays > 1 ? ", et la suite se décale d'un jour" : "";
    return `${capitalize(diff.repeatedFood)} sera reproposé demain${suite}.`;
  }
  if (diff.changedDays === 0) return null;
  if (diff.addedFoods.length > 0) {
    return `Les jours qui viennent ont été réajustés — ${joinNames(diff.addedFoods)} y ${diff.addedFoods.length > 1 ? "font" : "fait"} son entrée.`;
  }
  return diff.changedDays === 1
    ? "Le programme de demain a été réajusté."
    : `Les ${diff.changedDays} prochains jours ont été réajustés.`;
}

/**
 * The message that goes with a refusal. It describes no change — a refusal
 * produces none (decision G) — but that is precisely where the parent doubts,
 * and the app's silence was the real gap.
 */
export function refusalReassurance(foodName: string | null): string {
  const quoi = foodName ? `${capitalize(foodName)}` : "Cet aliment";
  return `Un refus, c'est normal. ${quoi} est reproposé demain — il faut souvent huit à dix essais avant qu'un goût soit accepté.`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function joinNames(names: string[]): string {
  const shown = names.slice(0, 3);
  if (shown.length === 1) return shown[0].toLowerCase();
  const lower = shown.map((n) => n.toLowerCase());
  return `${lower.slice(0, -1).join(", ")} et ${lower[lower.length - 1]}`;
}
