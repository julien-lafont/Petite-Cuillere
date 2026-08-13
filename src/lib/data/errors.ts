import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Message à montrer au parent quand une écriture est refusée par la base.
 *
 * Par défaut `fallback`, et le détail part dans les logs : les chaînes de
 * PostgREST nomment la contrainte, la colonne ou la politique qui a refusé
 * l'écriture. C'est la carte du schéma, offerte à qui envoie des écritures
 * volontairement invalides — et c'est du jargon anglais pour des parents
 * francophones.
 *
 * Une exception, `P0001` : le code d'un `raise exception` de nos propres
 * fonctions. « Invitation invalide ou déjà utilisée », « réservé au responsable
 * du foyer » sont de la copie, écrite pour être lue.
 */
export function userMessage(
  context: string,
  error: PostgrestError | null,
  fallback: string,
): string {
  if (!error) return fallback;
  console.error(`${context}:`, error.message);
  return error.code === "P0001" ? error.message : fallback;
}
