/**
 * Pronom de l'enfant — parler de lui avec les bons mots partout dans l'app.
 *
 * On stocke le **pronom** (« elle », « il », « iel »), pas un « genre » : c'est
 * ce dont le texte a réellement besoin, et c'est la formulation la plus neutre.
 *
 * Deux registres de rendu (décisions de cadrage) :
 *   · « elle » / « il » → pronom sujet + accords classiques (« née », « prêt ») ;
 *   · « iel » (et profils anciens à NULL) → **reformulation sans marqueur** :
 *     on garde le pronom sujet « iel » là où il n'entraîne aucun accord (« iel a
 *     goûté », auxiliaire avoir), et partout où un accord au participe/adjectif
 *     serait nécessaire (« né·e », « prêt·e »), on reformule autour du prénom
 *     pour éviter le point médian.
 */

export type Pronoun = "elle" | "il" | "iel";

export const PRONOUN_OPTIONS: {
  value: Pronoun;
  label: string;
  example: string;
}[] = [
  { value: "elle", label: "Elle", example: "Elle découvre" },
  { value: "il", label: "Il", example: "Il découvre" },
  { value: "iel", label: "Iel", example: "Iel découvre" },
];

const VALID = new Set<string>(PRONOUN_OPTIONS.map((o) => o.value));

/**
 * Ramène n'importe quelle valeur stockée à un pronom connu. Absente, inconnue
 * ou NULL (profil créé avant la fonctionnalité) → neutre « iel ».
 */
export function resolvePronoun(value: string | null | undefined): Pronoun {
  return value && VALID.has(value) ? (value as Pronoun) : "iel";
}

/** Pronom sujet en minuscule : « elle » | « il » | « iel ». */
export function subjectPronoun(value: string | null | undefined): string {
  return resolvePronoun(value);
}

/** Pronom sujet capitalisé, pour un début de phrase : « Elle » | « Il » | « Iel ». */
export function subjectPronounCap(value: string | null | undefined): string {
  const p = resolvePronoun(value);
  return p.charAt(0).toUpperCase() + p.slice(1);
}

/**
 * Choisit la variante accordée d'une tournure selon le pronom. Fournir la forme
 * neutre (`iel`) déjà reformulée sans marqueur — jamais un « né·e » à trous.
 *
 * @example
 * agree(baby.pronoun, {
 *   il: `${p} est né`,
 *   elle: `${p} est née`,
 *   iel: `La naissance de ${p} remonte à`,
 * })
 */
export function agree(
  value: string | null | undefined,
  forms: { elle: string; il: string; iel: string },
): string {
  return forms[resolvePronoun(value)];
}
