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
import type { VoiceError, VoiceListenReply } from "@/lib/voice/types";

/**
 * `POST /api/voix/ecoute` — dire au navigateur comment écouter.
 *
 * Le régime se décide ici, pas là-bas : c'est le serveur qui lit
 * `VOICE_TRANSCRIPTION`, ce qui permet d'en changer sans reconstruire le
 * navigateur (§8.2). La réponse est donc de deux formes :
 *
 *   · **`pre-recorded`** — rien d'autre à dire. Le navigateur enregistre, puis
 *     poste son audio à `POST /api/voix/transcrire`. Aucun appel externe ici,
 *     aucun contexte chargé : la réponse part en quelques millisecondes ;
 *   · **`live`** — une **URL WebSocket à usage unique**, que le serveur obtient
 *     avec la clé du compte. Le navigateur ne peut pas la demander lui-même : il
 *     faudrait lui confier cette clé (§7). L'audio, lui, ne passe pas par nous —
 *     il va du micro à Gladia en direct.
 *
 * Dans les deux cas, ce qui ressort revient par `POST /api/voix` comme une
 * phrase tapée : la compréhension ne sait pas si le parent a parlé ou écrit.
 */

/** Le message que voit le parent quand la transcription est hors service. */
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
  // Le taux vient du navigateur parce que lui seul le connaît : il obtient
  // celui de la carte son, pas celui qu'on lui demande. Hors de la liste
  // acceptée, mieux vaut basculer à l'écrit que transcrire du bruit.
  if (typeof sampleRate !== "number" || !isSampleRateSupported(sampleRate)) {
    return fail(UNAVAILABLE, 400);
  }

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

  // La taille du lexique est le premier réglage à instrumenter (§4.2.2) : c'est
  // elle qui décide de la qualité de l'appariement phonétique. L'URL, elle, ne
  // se journalise pas — elle porte le jeton de la session.
  console.info(
    `[voice] session ${session.id} · ${lexicon.length} terme(s) · ` +
      `${sampleRate} Hz · ${Date.now() - start} ms`,
  );

  return Response.json({
    mode: "live",
    url: session.url,
  } satisfies VoiceListenReply);
}
