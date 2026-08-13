/**
 * Longueurs maximales des textes saisis dans l'application.
 *
 * Aucune n'est une règle métier : la plus serrée dépasse d'un facteur deux la
 * plus longue valeur du catalogue livré, et personne ne les rencontre en
 * écrivant. Elles existent parce que PostgREST accepte tout ce que la RLS
 * laisse passer, et qu'un nom d'aliment est recopié dans le prompt à chaque
 * dictée du foyer.
 *
 * La base porte les mêmes valeurs (migration 0027) et fait seule autorité ;
 * celles-ci servent à dire **quel** champ corriger, ce qu'une violation de
 * contrainte ne sait pas faire.
 */
export const TEXT_LIMITS = {
  foodName: 80,
  foodCategory: 40,
  foodAllergenType: 40,
  foodTexture: 60,
  foodPreparation: 500,
  foodRestrictions: 300,
  foodQuantity: 120,
  momentLabel: 40,
  mealNote: 1000,
  observationNote: 1000,
  personPrenom: 50,
  personRelation: 60,
} as const;

/** Champ à valider : son libellé à l'écran, sa valeur, sa borne. */
type Bounded = [label: string, value: string | null | undefined, max: number];

/**
 * Message de refus du premier champ trop long, ou `null`. Le libellé est celui
 * que le parent lit à l'écran.
 */
export function tooLongMessage(fields: Bounded[]): string | null {
  for (const [label, value, max] of fields) {
    if ((value?.length ?? 0) > max) {
      return `${label} ne peut pas dépasser ${max} caractères.`;
    }
  }
  return null;
}

/**
 * Coupe à la borne, sans rien dire.
 *
 * Pour les notes du parent uniquement : « enregistrer d'abord, ne jamais
 * refuser » (cf. `meal-reality.actions.ts`) — un parent dont la saisie est
 * rejetée cesse de saisir.
 */
export function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
