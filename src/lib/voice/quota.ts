import type { createClient } from "@/lib/supabase/server";
import type { VoiceError } from "@/lib/voice/types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * A person's voice budget (migration 0029).
 *
 * Every call the three microphone routes accept spends money with a third
 * party. The bounds live in Postgres, not here: the functions are stateless and
 * run in parallel, so an in-memory counter would count nothing.
 *
 * A failure of the counter refuses the call. A spend cap that opens when the
 * database coughs caps nothing — and the parent keeps the day screen to write it
 * by hand, which is what the feature already says on every incident.
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
 * Charges one call. Returns `null` when the route may continue, otherwise the
 * response to return as-is.
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
