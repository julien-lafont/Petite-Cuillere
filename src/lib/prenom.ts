/**
 * The child's first name: canonical form and maximum length.
 *
 * The name shows up all over the app, often mid-sentence ("Qu'est-ce que Léa a
 * déjà goûté ?"). One-handed typing at 6am produces "léa", "LEA" or "lÉa": we
 * reshape it on save rather than refusing the entry or fixing it at render time.
 *
 * Normalisation runs on the server, on every write path (`setupBaby`,
 * `updateBaby`): the stored form is the authority.
 */

/**
 * 50 characters: past that it is not a first name. Wide enough for the longest
 * compound names, short enough that no layout needs rethinking. The database
 * carries the same bound (migration 0014).
 */
export const MAX_PRENOM_LENGTH = 50;

/**
 * Start of each component of a name: the first character, or the one after a
 * space, a dash (every Unicode dash, `\p{Pd}`) or an apostrophe —
 * "Pierre-Henri", "Jean Jacques", "N'Golo".
 */
const COMPONENT_START = /(^|[\s\p{Pd}'’])(\p{L})/gu;

/**
 * Puts the name in canonical form: extra spaces dropped, one capital per
 * component, the rest lowercase.
 *
 * Case is folded with the French locale: without it "ı" and "i" hold surprises,
 * and accents must survive uppercasing ("élise" → "Élise").
 */
export function normalizePrenom(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fr-FR")
    .replace(
      COMPONENT_START,
      (_match, separator: string, letter: string) =>
        separator + letter.toLocaleUpperCase("fr-FR"),
    );
}
