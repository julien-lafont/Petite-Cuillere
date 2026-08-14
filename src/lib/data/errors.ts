import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Message to show the parent when the database refuses a write.
 *
 * `fallback` by default, with the detail sent to the logs: PostgREST strings
 * name the constraint, column or policy that refused the write. That is a map of
 * the schema, handed to whoever sends deliberately invalid writes — and it is
 * English jargon for French-speaking parents.
 *
 * One exception, `P0001`: the code raised by our own functions. "Invitation
 * invalide ou déjà utilisée", "réservé au responsable du foyer" are copy,
 * written to be read.
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
