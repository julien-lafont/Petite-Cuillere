/**
 * Prénom de l'enfant : forme canonique et longueur maximale.
 *
 * Le prénom est affiché partout dans l'app, souvent au milieu d'une phrase
 * (« Qu'est-ce que Léa a déjà goûté ? »). Une saisie faite d'une main à 6 h du
 * matin arrive en « léa », « LEA » ou « lÉa » : on la remet en forme au moment
 * d'enregistrer plutôt que de refuser la saisie ou de corriger à l'affichage.
 *
 * La normalisation est appliquée côté serveur, sur tous les chemins d'écriture
 * (`setupBaby`, `updateBaby`) : c'est la forme stockée qui fait foi.
 */

/**
 * 50 caractères : au-delà, ce n'est plus un prénom. Assez large pour les
 * prénoms composés les plus longs, assez court pour qu'aucune mise en page ne
 * soit à repenser. La même borne est posée côté base (migration 0014).
 */
export const MAX_PRENOM_LENGTH = 50;

/**
 * Début de chaque composante d'un prénom : le premier caractère, ou celui qui
 * suit un espace, un tiret (tous les tirets Unicode, `\p{Pd}`) ou une
 * apostrophe — « Pierre-Henri », « Jean Jacques », « N'Golo ».
 */
const COMPONENT_START = /(^|[\s\p{Pd}'’])(\p{L})/gu;

/**
 * Met le prénom sous sa forme canonique : espaces superflus supprimés, une
 * majuscule par composante, le reste en minuscules.
 *
 * La casse est traitée avec la locale française : sans elle, « ı » et « i »
 * réservent des surprises, et les accents doivent survivre au passage en
 * majuscule (« élise » → « Élise »).
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
