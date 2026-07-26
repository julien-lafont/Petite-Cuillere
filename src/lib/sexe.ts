/**
 * Sexe de l'enfant — parler de lui avec les bons mots partout dans l'app.
 *
 * Modèle volontairement binaire (« fille » / « garçon ») : c'est la question la
 * plus simple à poser à l'onboarding, et elle suffit à dériver tout ce dont le
 * texte a besoin — pronom sujet (« elle »/« il ») et accords au participe ou à
 * l'adjectif (« née »/« né », « prête »/« prêt »).
 *
 * NULL (profils créés avant cette fonctionnalité, ou anciennement neutres)
 * retombe sur le masculin, défaut grammatical du français. Ce n'est qu'un
 * repli de rendu : le parent fixe la valeur depuis le profil de l'enfant.
 */

export type Sexe = "fille" | "garcon";

export const SEXE_OPTIONS: { value: Sexe; label: string }[] = [
  { value: "fille", label: "Une fille" },
  { value: "garcon", label: "Un garçon" },
];

const VALID = new Set<string>(SEXE_OPTIONS.map((o) => o.value));

/** Ramène n'importe quelle valeur stockée à un sexe connu (repli : masculin). */
export function resolveSexe(value: string | null | undefined): Sexe {
  return value && VALID.has(value) ? (value as Sexe) : "garcon";
}

/** Pronom sujet en minuscule : « elle » | « il ». */
export function subjectPronoun(value: string | null | undefined): string {
  return resolveSexe(value) === "fille" ? "elle" : "il";
}

/** Pronom sujet capitalisé, pour un début de phrase : « Elle » | « Il ». */
export function subjectPronounCap(value: string | null | undefined): string {
  return resolveSexe(value) === "fille" ? "Elle" : "Il";
}

/**
 * Choisit la variante accordée d'une tournure selon le sexe.
 *
 * @example
 * agree(baby.sexe, {
 *   fille: `${p} est née`,
 *   garcon: `${p} est né`,
 * })
 */
export function agree(
  value: string | null | undefined,
  forms: { fille: string; garcon: string },
): string {
  return forms[resolveSexe(value)];
}
