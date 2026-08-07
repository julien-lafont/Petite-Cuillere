/**
 * Ce que la replanification a changé, et comment le dire — LOGIQUE PURE.
 * Voir docs/feats/suivi-reel-et-rattrapage.md §4.6 et §7.3.
 *
 * Le parent doit comprendre que le programme vit, sans avoir à le deviner ni à
 * comparer deux écrans. D'où une phrase courte, factuelle, jamais comptable :
 * on dit ce qui arrive demain, pas combien de jours ont bougé.
 *
 * Règle de rédaction non négociable (D8) : aucun vocabulaire d'écart, de
 * manquement ou de rattrapage subi. « On a ajusté », jamais « vous n'avez pas
 * suivi ».
 */

/** Un repas, réduit à ce que la comparaison regarde. */
export type ComparableMeal = {
  date: string;
  momentId: string;
  foodIds: string[];
};

export type PlanDiff = {
  /** Nombre de journées dont au moins un repas change. */
  changedDays: number;
  /** Aliment reproposé dès demain au titre de la règle des deux jours (R2). */
  repeatedFood?: string;
  /** Aliments qui entrent au programme et n'y étaient pas. */
  addedFoods: string[];
  /** Aliments qui en sortent. */
  removedFoods: string[];
};

const key = (m: { date: string; momentId: string }) =>
  `${m.date}|${m.momentId}`;

/** Deux compositions identiques, à l'ordre près. */
export function sameComposition(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

/**
 * Compare l'ancien programme au nouveau, sur la période replanifiée.
 * `nameOf` sert à produire des libellés lisibles ; un identifiant inconnu est
 * simplement ignoré, pour ne jamais afficher un UUID au parent.
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
 * La phrase montrée au parent après un signal. `null` quand rien n'a bougé :
 * mieux vaut ne rien dire qu'annoncer un ajustement fantôme.
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
 * Le message qui accompagne un refus. Il ne décrit aucun changement — un refus
 * n'en produit aucun (décision G) — mais c'est précisément là que le parent
 * doute, et le silence de l'app était le vrai manque.
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
