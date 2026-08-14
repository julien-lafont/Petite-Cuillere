import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BABY_COOKIE } from "@/lib/data/baby";
import { loadVoiceContext } from "@/lib/voice/load";
import { buildLexicon } from "@/lib/voice/lexicon";
import {
  isSampleRateSupported,
  openLiveSession,
  transcriptionMode,
} from "@/lib/voice/transcribe";
import { refuseIfOverQuota } from "@/lib/voice/quota";
import type { VoiceError, VoiceListenReply } from "@/lib/voice/types";

/**
 * `POST /api/voix/ecoute` — telling the browser how to listen.
 *
 * The mode is decided here, not there: the server reads `VOICE_TRANSCRIPTION`,
 * which lets us change it without rebuilding the browser bundle (§8.2). So the
 * answer comes in two shapes:
 *
 *   · **`pre-recorded`** — nothing else to say. The browser records, then posts
 *     its audio to `POST /api/voix/transcrire`. No external call here, no
 *     context loaded: the answer leaves in a few milliseconds;
 *   · **`live`** — a **single-use WebSocket URL**, which the server obtains with
 *     the account key. The browser cannot ask for it itself: that would mean
 *     handing it the key (§7). The audio does not pass through us — it goes from
 *     the mic to Gladia directly.
 *
 * Either way, what comes out comes back through `POST /api/voix` like a typed
 * sentence: understanding does not know whether the parent spoke or wrote.
 */

/** The message the parent sees when transcription is out of service. */
const UNAVAILABLE = "Le micro n'est pas disponible. Écrivez-le, c'est pareil.";

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

  if (transcriptionMode() === "pre-recorded") {
    return Response.json({
      mode: "pre-recorded",
    } satisfies VoiceListenReply);
  }

  let sampleRate: unknown;
  try {
    sampleRate = ((await request.json()) as { sampleRate?: unknown })
      .sampleRate;
  } catch {
    return fail("Requête illisible.", 400);
  }
  // The rate comes from the browser because only it knows: it gets the sound
  // card's, not the one we asked for. Outside the accepted list, switching to
  // typing beats transcribing noise.
  if (typeof sampleRate !== "number" || !isSampleRateSupported(sampleRate)) {
    return fail(UNAVAILABLE, 400);
  }

  // The pre-recorded mode returned above without spending anything: only the
  // live session opens a channel at Gladia, and only it is charged.
  const refused = await refuseIfOverQuota(supabase);
  if (refused) return refused;

  const cookieStore = await cookies();
  const loaded = await loadVoiceContext(
    cookieStore.get(ACTIVE_BABY_COOKIE)?.value,
  );
  if (!loaded) return fail("Aucun enfant dans ce foyer.", 400);

  const lexicon = buildLexicon(loaded.ctx);

  let session;
  try {
    session = await openLiveSession({ lexicon, sampleRate });
  } catch (error) {
    console.error("voice/transcribe:", error);
    return fail(UNAVAILABLE, 503);
  }

  // Lexicon size is the first setting to instrument (§4.2.2): it decides the
  // quality of the phonetic match. The URL is not logged — it carries the
  // session token.
  console.info(
    `[voice] session ${session.id} · ${lexicon.length} terme(s) · ` +
      `${sampleRate} Hz · ${Date.now() - start} ms`,
  );

  return Response.json({
    mode: "live",
    url: session.url,
  } satisfies VoiceListenReply);
}
