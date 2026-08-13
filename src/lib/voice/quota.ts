import type { createClient } from "@/lib/supabase/server";
import type { VoiceError } from "@/lib/voice/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Le budget de voix d'une personne (cf. migration 0029).
 *
 * Chaque appel accepté par les trois routes du micro dépense de l'argent chez un
 * tiers. Les bornes vivent en base, pas ici : les fonctions sont sans état et
 * s'exécutent en parallèle, un compteur en mémoire ne compterait rien.
 *
 * En cas de panne du décompte, on refuse. Un plafond de dépense qui s'ouvre
 * quand la base tousse ne plafonne rien — et le parent garde l'écran du jour
 * pour saisir à la main, ce que la fonctionnalité dit déjà à chaque incident.
 */
type Verdict = "ok" | "burst" | "daily" | "unavailable";

const MESSAGES: Record<Exclude<Verdict, "ok">, [string, number]> = {
  burst: ["Trop de demandes d'un coup. Réessayez dans un instant.", 429],
  daily: [
    "Le micro a beaucoup servi aujourd'hui. Il revient demain — en attendant, écrivez-le, c'est pareil.",
    429,
  ],
  unavailable: [
    "Le micro n'est pas disponible. Écrivez-le, c'est pareil.",
    503,
  ],
};

/**
 * Décompte un appel. Renvoie `null` si la route peut continuer, sinon la
 * réponse à retourner telle quelle.
 */
export async function refuseIfOverQuota(
  supabase: SupabaseClient,
): Promise<Response | null> {
  const { data, error } = await supabase.rpc("consume_voice_call");
  if (error) {
    console.error("voice/quota:", error.message);
    return refusal("unavailable");
  }
  if (data === "ok") return null;
  return refusal(data === "burst" || data === "daily" ? data : "unavailable");
}

function refusal(verdict: Exclude<Verdict, "ok">): Response {
  const [message, status] = MESSAGES[verdict];
  return Response.json({ error: message } satisfies VoiceError, { status });
}
