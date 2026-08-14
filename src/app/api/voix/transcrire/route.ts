import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BABY_COOKIE } from "@/lib/data/baby";
import { loadVoiceContext } from "@/lib/voice/load";
import { buildLexicon } from "@/lib/voice/lexicon";
import { transcribe, transcriptionMode } from "@/lib/voice/transcribe";
import { refuseIfOverQuota } from "@/lib/voice/quota";
import type { VoiceError, VoiceTranscriptReply } from "@/lib/voice/types";

/**
 * `POST /api/voix/transcrire` — a dictation's audio, in async mode.
 *
 * This route only exists for the `pre-recorded` mode: it is the counterpart of
 * streaming, where the audio never passes through our hands. Here it does, for
 * the length of a round trip, and **it does not stop**: nothing is written to
 * disk, nothing enters the database, the object is released with the request
 * (§7).
 *
 * The body is the raw WAV rather than a multipart form: the browser already
 * assembles its PCM frames, and wrapping them a second time would only copy a
 * megabyte for nothing.
 */

/** The message the parent sees when transcription is out of service. */
const UNAVAILABLE = "Le micro n'est pas disponible. Écrivez-le, c'est pareil.";

/**
 * Thirty seconds of 16-bit PCM at 48 kHz is 2.9 MB, and the dictation stops on
 * its own well before that. Past it, this is no longer a sentence — and the host
 * would refuse the body anyway.
 */
const MAX_BYTES = 4_000_000;

function fail(message: string, status: number) {
  return Response.json({ error: message } satisfies VoiceError, { status });
}

export async function POST(request: Request) {
  const start = Date.now();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Session expirée.", 401);

  // A route that transcribes while streaming is in force should never be
  // called: we refuse rather than serve a mode we do not announce.
  if (transcriptionMode() !== "pre-recorded") return fail(UNAVAILABLE, 409);

  const audio = await request.blob();
  if (audio.size === 0) return fail("Je n'ai rien entendu.", 400);
  if (audio.size > MAX_BYTES) {
    return fail("C'est un peu long — dites-le en une ou deux phrases.", 413);
  }

  const refused = await refuseIfOverQuota(supabase);
  if (refused) return refused;

  const cookieStore = await cookies();
  const loaded = await loadVoiceContext(
    cookieStore.get(ACTIVE_BABY_COOKIE)?.value,
  );
  if (!loaded) return fail("Aucun enfant dans ce foyer.", 400);

  const lexicon = buildLexicon(loaded.ctx);

  let transcript: string;
  try {
    transcript = await transcribe({ audio, lexicon });
  } catch (error) {
    console.error("voice/transcribe:", error);
    return fail(UNAVAILABLE, 503);
  }

  // The time measured here is the visible half of the §3.4 budget: the time the
  // parent spends in front of a screen saying "transcribing". It leaves with
  // the text, and the browser will send it back in its trace — otherwise the
  // transcription half of the budget would stay in one-hour logs.
  const latency = Date.now() - start;
  console.info(
    `[voice] transcription ${latency} ms · ` +
      `${Math.round(audio.size / 1024)} Ko · ${lexicon.length} terme(s)`,
  );

  return Response.json({ transcript, latency } satisfies VoiceTranscriptReply);
}
