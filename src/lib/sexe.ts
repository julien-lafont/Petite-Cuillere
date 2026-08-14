/**
 * The child's sex — so the app talks about them with the right words.
 *
 * Deliberately binary ("fille" / "garçon"): it is the simplest question to ask
 * at onboarding, and it is enough to derive everything the copy needs — subject
 * pronoun ("elle"/"il") and participle or adjective agreement ("née"/"né",
 * "prête"/"prêt").
 *
 * NULL — profiles created before this feature, or once neutral — falls back to
 * masculine, French's grammatical default. That is a render fallback only: the
 * parent sets the value from the child's profile.
 */

export type Sexe = "fille" | "garcon";

export const SEXE_OPTIONS: { value: Sexe; label: string }[] = [
  { value: "fille", label: "Une fille" },
  { value: "garcon", label: "Un garçon" },
];

const VALID = new Set<string>(SEXE_OPTIONS.map((o) => o.value));

/** Maps any stored value to a known sex (fallback: masculine). */
export function resolveSexe(value: string | null | undefined): Sexe {
  return value && VALID.has(value) ? (value as Sexe) : "garcon";
}

/** Lowercase subject pronoun: "elle" | "il". */
export function subjectPronoun(value: string | null | undefined): string {
  return resolveSexe(value) === "fille" ? "elle" : "il";
}

/** Capitalised subject pronoun, to open a sentence: "Elle" | "Il". */
export function subjectPronounCap(value: string | null | undefined): string {
  return resolveSexe(value) === "fille" ? "Elle" : "Il";
}

/**
 * Picks the agreeing variant of a phrase from the child's sex.
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
