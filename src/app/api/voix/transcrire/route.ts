import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BABY_COOKIE } from "@/lib/data/baby";
import { loadVoiceContext } from "@/lib/voice/load";
import { buildLexicon } from "@/lib/voice/lexicon";
import { transcribe, transcriptionMode } from "@/lib/voice/transcribe";
import type { VoiceError, VoiceTranscriptReply } from "@/lib/voice/types";

/**
 * `POST /api/voix/transcrire` — l'audio d'une dictée, en régime asynchrone.
 *
 * Cette route n'existe que pour le régime `pre-recorded` : c'est la contrepartie
 * du flux, où l'audio ne nous passe jamais entre les mains. Ici il transite, le
 * temps d'un aller-retour, et **il ne s'arrête pas** : rien n'est écrit sur
 * disque, rien n'entre en base, l'objet est relâché avec la requête (§7).
 *
 * Le corps est le WAV brut plutôt qu'un formulaire multipart : le navigateur
 * assemble déjà ses trames PCM, et l'envelopper une seconde fois ne servirait
 * qu'à recopier un mégaoctet pour rien.
 */

/** Le message que voit le parent quand la transcription est hors service. */
const UNAVAILABLE = "Le micro n'est pas disponible. Écrivez-le, c'est pareil.";

/**
 * Trente secondes de PCM 16 bits à 48 kHz font 2,9 Mo, et la dictée s'arrête
 * d'elle-même bien avant. Au-delà, ce n'est plus une phrase — et l'hébergeur
 * refuserait le corps de toute façon.
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

  // Une route qui transcrit alors que le flux est en vigueur ne devrait jamais
  // être appelée : on refuse plutôt que de servir un régime qu'on n'annonce pas.
  if (transcriptionMode() !== "pre-recorded") return fail(UNAVAILABLE, 409);

  const audio = await request.blob();
  if (audio.size === 0) return fail("Je n'ai rien entendu.", 400);
  if (audio.size > MAX_BYTES) {
    return fail("C'est un peu long — dites-le en une ou deux phrases.", 413);
  }

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

  // Le temps mesuré ici est la moitié visible du budget de §3.4 : c'est celui
  // que le parent passe devant un écran qui dit « je transcris ».
  console.info(
    `[voice] transcription ${Date.now() - start} ms · ` +
      `${Math.round(audio.size / 1024)} Ko · ${lexicon.length} terme(s)`,
  );

  return Response.json({ transcript } satisfies VoiceTranscriptReply);
}
