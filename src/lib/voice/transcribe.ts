import type { Term } from "@/lib/voice/lexicon";

/**
 * The transcription adapter — Gladia, in its two modes (§4.2).
 *
 * The provider stays behind a signature: the rest of the code never learns its
 * name, and the day we change it, this file is what gets rewritten.
 *
 * **Two modes coexist, switched by `VOICE_TRANSCRIPTION`**:
 *
 *   · `pre-recorded` (default) — `solaria-3`, the best model on real French, but
 *     it only exists asynchronously. The browser records, sends the lot in one
 *     block, and the text arrives once the sentence is over;
 *   · `live` — `solaria-1`, less accurate, but it writes words **while** you
 *     speak. Transcription time then dissolves into speaking time instead of
 *     adding to it.
 *
 * So the trade-off is not "fast versus slow": it is **accuracy of the text
 * versus watching it appear**. Both have a case, measurement will settle it, and
 * the variable exists so we can measure without redeploying.
 *
 * **The key never leaves the server** (§7), in both modes. In streaming it opens
 * a session and Gladia answers with a short-lived token WebSocket URL — that,
 * not the key, is what the browser gets. In async, the audio comes back through
 * our own endpoint, which pushes it on to Gladia.
 */

const LIVE_URL = "https://api.gladia.io/v2/live";
const UPLOAD_URL = "https://api.gladia.io/v2/upload";
const BATCH_URL = "https://api.gladia.io/v2/pre-recorded";

/**
 * §4.2 settled on `solaria-3`, and the choice holds — but the real-time API does
 * not accept it as of today. That is the whole reason the two modes exist: the
 * day `solaria-3` reaches streaming, these two constants merge and the
 * environment variable loses its point.
 */
const LIVE_MODEL = "solaria-1";
const BATCH_MODEL = "solaria-3";

/**
 * Silence duration that closes an utterance, in seconds. The default (0.05 s)
 * chops a dictation into crumbs; at 0.3 s a mid-sentence hesitation no longer
 * splits it in two, and a real full stop is still detected well before our own
 * silence threshold stops the mic.
 */
const ENDPOINTING = 0.3;

export type TranscriptionMode = "live" | "pre-recorded";

/**
 * The mode in force, read from the environment.
 *
 * `pre-recorded` by default: at unequal transcription quality, we take the
 * better. An unknown value falls back to the default rather than taking the mic
 * down — a typo in a variable must not deprive a parent of the feature, it must
 * show up in the logs.
 */
export function transcriptionMode(): TranscriptionMode {
  const configured = process.env.VOICE_TRANSCRIPTION;
  if (configured === "live" || configured === "pre-recorded") return configured;
  if (configured) {
    console.warn(
      `[voice] VOICE_TRANSCRIPTION="${configured}" inconnu — « pre-recorded » retenu.`,
    );
  }
  return "pre-recorded";
}

/** The only sample rates the API accepts. */
const SAMPLE_RATES = [8000, 16000, 32000, 44100, 48000] as const;
export type SampleRate = (typeof SAMPLE_RATES)[number];

export function isSampleRateSupported(value: number): value is SampleRate {
  return (SAMPLE_RATES as readonly number[]).includes(value);
}

export type LiveSession = {
  /** Single-use WebSocket URL, token included. Do not log. */
  url: string;
  id: string;
};

export type LiveSessionInput = {
  /** First names, foods, allergens: the household lexicon. */
  lexicon: Term[];
  /** The browser's own, as it actually obtained it. */
  sampleRate: SampleRate;
};

/** The service rarely takes more than a second; past that, we give up. */
const TIMEOUT_MS = 8000;

/**
 * Phonetic matching, or nothing.
 *
 * **An empty lexicon is refused by the API** ("must contain at least 1
 * elements"), and the refusal lands when the session opens: without this guard,
 * a household that has just signed up — no food yet, a three-letter first name —
 * would never get a mic at all. Transcribing without a lexicon beats not
 * transcribing.
 *
 * Intensity is the setting to watch (§4.2.2), and it tunes downward. Measured on
 * real dictations, streaming: at 0.5 as at 0.4, "il a mangé des **poireaux**"
 * comes back as "il a mangé des **Poire**" — the engine swaps a correct word for
 * a neighbour from the catalogue. At 0.3 the sentence survives intact and rare
 * words ("panais", "fenouil") are still caught.
 *
 * So we sit below the documented range (0.4–0.6), deliberately: it targets jargon
 * lexicons, where ours is full of ordinary French words — "poire", "pomme",
 * "chou" — that resemble too many things. One rare word missed costs less than
 * one correct word broken.
 *
 * The measurement was made on `solaria-1`; it has yet to be redone on
 * `solaria-3`, which has no reason to share exactly the same thresholds.
 */
function vocabulary(lexicon: Term[]) {
  if (lexicon.length === 0) return { custom_vocabulary: false };
  return {
    custom_vocabulary: true,
    custom_vocabulary_config: {
      default_intensity: 0.3,
      vocabulary: lexicon.map((term) =>
        term.variants || term.intensity
          ? {
              value: term.value,
              ...(term.variants ? { pronunciations: term.variants } : {}),
              ...(term.intensity ? { intensity: term.intensity } : {}),
            }
          : term.value,
      ),
    },
  };
}

function apiKey() {
  const key = process.env.GLADIA_API_KEY;
  if (!key) throw new Error("GLADIA_API_KEY is not configured");
  return key;
}

async function refuse(response: Response): Promise<never> {
  const body = await response.text().catch(() => "");
  throw new Error(`Gladia ${response.status}: ${body.slice(0, 300)}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Streaming (`live`)
// ────────────────────────────────────────────────────────────────────────────

export async function openLiveSession({
  lexicon,
  sampleRate,
}: LiveSessionInput): Promise<LiveSession> {
  const response = await fetch(LIVE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-gladia-key": apiKey() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      encoding: "wav/pcm",
      bit_depth: 16,
      sample_rate: sampleRate,
      channels: 1,
      model: LIVE_MODEL,
      endpointing: ENDPOINTING,
      // A parent dictates a sentence, not a monologue: the net is low.
      maximum_duration_without_endpointing: 10,
      language_config: { languages: ["fr"], code_switching: false },
      realtime_processing: vocabulary(lexicon),
      messages_config: {
        // The partial is the whole point of real time: it is what shows on screen
        // while you speak.
        receive_partial_transcripts: true,
        receive_final_transcripts: true,
        // The rest is noise on the wire: we already hold our own sound level, and
        // we have no use for lifecycle events.
        receive_speech_events: false,
        receive_pre_processing_events: false,
        receive_realtime_processing_events: false,
        receive_post_processing_events: true,
        receive_acknowledgments: false,
        receive_errors: true,
        receive_lifecycle_events: false,
      },
    }),
  });

  if (!response.ok) await refuse(response);

  const session = (await response.json()) as { id?: string; url?: string };
  if (!session.url) throw new Error("Gladia returned no session URL");
  return { url: session.url, id: session.id ?? "?" };
}

// ────────────────────────────────────────────────────────────────────────────
// Async (`pre-recorded`)
// ────────────────────────────────────────────────────────────────────────────

/** Result polling: short, because the parent is waiting at the screen. */
const POLL_MS = 200;
const POLL_TIMEOUT_MS = 25_000;

export type TranscribeInput = {
  /** The WAV assembled by the browser, 16-bit mono PCM. */
  audio: Blob;
  lexicon: Term[];
};

/**
 * Three calls and a wait: we upload the file, start the job, and poll until the
 * answer.
 *
 * Polling rather than a `callback` is deliberate: a dictation is synchronous
 * from the parent's point of view — they are waiting at the screen. An HTTP
 * callback would force us to hold a channel open to the client for nothing
 * (§4.2.1).
 */
export async function transcribe({
  audio,
  lexicon,
}: TranscribeInput): Promise<string> {
  const key = apiKey();

  const form = new FormData();
  form.append("audio", audio, "dictee.wav");
  const upload = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { "x-gladia-key": key },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!upload.ok) await refuse(upload);
  const { audio_url: audioUrl } = (await upload.json()) as {
    audio_url?: string;
  };
  if (!audioUrl) throw new Error("Gladia returned no audio URL");

  const job = await fetch(BATCH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-gladia-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      audio_url: audioUrl,
      model: BATCH_MODEL,
      language_config: { languages: ["fr"], code_switching: false },
      ...vocabulary(lexicon),
      // A single speaker: diarisation would cost time for nothing.
      diarization: false,
    }),
  });
  if (!job.ok) await refuse(job);
  const { result_url: resultUrl } = (await job.json()) as {
    result_url?: string;
  };
  if (!resultUrl) throw new Error("Gladia returned no result URL");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const poll = await fetch(resultUrl, {
      headers: { "x-gladia-key": key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!poll.ok) await refuse(poll);
    const body = (await poll.json()) as {
      status?: string;
      error_code?: unknown;
      result?: { transcription?: { full_transcript?: string } };
    };
    if (body.status === "done") {
      return body.result?.transcription?.full_transcript?.trim() ?? "";
    }
    if (body.status === "error") {
      throw new Error(`Gladia job failed: ${JSON.stringify(body.error_code)}`);
    }
  }
  throw new Error("Gladia job timed out");
}
