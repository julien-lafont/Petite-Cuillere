import { createClient } from "@/lib/supabase/server";
import { resolveModel } from "@/lib/voice/providers";
import { transcriptionMode } from "@/lib/voice/transcribe";
import { APP_VERSION } from "@/lib/version";

/**
 * `POST /api/voix/trace` — keep the measurement of a dictation, and nothing else.
 *
 * Latencies were already measured: each of the three voice routes ends on a
 * `console.info`. None was readable for all that — the host keeps runtime logs
 * for an hour on its free tier, and exports start one tier up. This route is
 * what was missing between the two.
 *
 * **It is called by the browser once the card is shown**, and that is the only
 * way to get the number that matters: the §3.4 budget starts at the end of
 * speech and crosses two network round-trips no server clock sees. The server
 * durations do make the round trip — measured here, returned to the browser, and
 * relayed back by it.
 *
 * What the browser says is therefore unverifiable, and does not need to be:
 * these are measurements, not rights. Every number is bounded, and an
 * out-of-bounds value becomes `null` rather than failing the write — a wrong
 * trace pollutes an average, a refused trace erases the whole dictation.
 *
 * The model and the mode, by contrast, are **never** read from the body: they
 * are re-read from the environment, exactly as the understanding route read them
 * a second earlier. It is free, it cannot be wrong, and it avoids announcing to
 * the browser which model we use.
 *
 * Nothing written here describes a child or a meal: durations, volumes, a model
 * name. That is what lets the measurement outlive the thirty days §7 grants a
 * transcription.
 */

/** Two minutes: past that it is not a latency, it is a wrong clock. */
const MAX_MS = 120_000;

function bounded(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > max) return null;
  return Math.round(value);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    const { data: householdId } = await supabase.rpc("current_household_id");
    const model = resolveModel();

    const { error } = await supabase.from("voice_traces").insert({
      household_id: householdId,
      // A typed sentence goes through the same understanding, with no mic: it counts
      // in the usage figures, and its latency is only comparable to itself.
      mode: body.typed === true ? "typed" : transcriptionMode(),
      model_id: model.id,
      effort: model.effort,
      app_version: APP_VERSION || null,
      speech_ms: bounded(body.speechMs, MAX_MS),
      transcription_ms: bounded(body.transcriptionMs, MAX_MS),
      understanding_ms: bounded(body.understandingMs, MAX_MS),
      route_ms: bounded(body.routeMs, MAX_MS),
      perceived_ms: bounded(body.perceivedMs, MAX_MS),
      audio_kb: bounded(body.audioKb, 8192),
      transcript_length: bounded(body.transcriptLength, 10_000),
      cache_read_tokens: bounded(body.cacheRead, 10_000_000),
      intents: bounded(body.intents, 100),
    });
    if (error) throw error;
  } catch (error) {
    // A lost measurement is not an incident: the parent's dictation is already
    // on screen, and nothing there depends on this write.
    console.error("voice/trace:", error);
  }

  return new Response(null, { status: 204 });
}
