/**
 * « Je n'ai pas ça » — le choix des remplaçants. LOGIQUE PURE.
 * Voir docs/feats/suivi-reel-et-rattrapage.md §4.2.
 *
 * La moitié des écarts se décident devant le frigo, pas après le repas. Proposer
 * trois remplaçants immédiatement transforme un abandon silencieux en une donnée
 * propre — et rend service au parent dans la seconde. C'est le geste le plus
 * rentable de toute la fonctionnalité.
 *
 * Critères, dans cet ordre :
 *   1. **même catégorie** — un légume remplace un légume, sinon le repas perd
 *      son équilibre et le programme son sens ;
 *   2. **déjà connu de l'enfant** — un remplacement n'est pas le moment d'une
 *      découverte : elle mérite son jour, sa répétition et son attention ;
 *   3. **le moins servi récemment** — on en profite pour varier.
 */

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
    /** Aliments déjà connus de l'enfant. */
    introducedIds: Set<string>;
    /** Occurrences récentes par aliment — pour servir le moins vu d'abord. */
    usage?: Record<string, number>;
    /** Âge projeté de l'enfant à la date du repas. */
    ageMonths: number;
    /** Aliments déjà au menu de ce repas : ne pas les proposer deux fois. */
    exclude?: Set<string>;
  },
): T[] {
  const { introducedIds, usage = {}, ageMonths, exclude } = options;

  const candidates = foods.filter(
    (f) =>
      f.id !== target.id &&
      f.category === target.category &&
      (f.age_introduction_min ?? 0) <= ageMonths &&
      !exclude?.has(f.id),
  );

  // Les connus d'abord — mais si l'enfant n'en connaît aucun dans cette
  // catégorie (tout début de diversification), mieux vaut proposer un aliment
  // neuf que ne rien proposer du tout.
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
