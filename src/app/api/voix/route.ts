import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BABY_COOKIE } from "@/lib/data/baby";
import { loadVoiceContext } from "@/lib/voice/load";
import { understand } from "@/lib/voice/understand";
import { resolveIntents } from "@/lib/voice/resolution";
import type { VoiceError, VoiceReply } from "@/lib/voice/types";

/**
 * `POST /api/voix` — comprendre, jamais écrire.
 *
 * Cinq étapes, dans cet ordre : authentification, contexte, compréhension,
 * validation serveur, réponse. **Aucune écriture en base ne part d'ici.** Le
 * modèle décrit une action, il n'en exécute aucune : c'est cette coupure qui
 * garantit que toutes les règles écrites dans `program/` et
 * `meal-reality.actions.ts` restent la seule autorité, et qu'une transcription
 * fantaisiste ne peut pas inventer une exposition à l'arachide (§4.1, décision A).
 *
 * L'écriture, elle, passe par `executeOrders` — après un tap du parent.
 */

/** Au-delà, ce n'est plus une dictée : c'est un copier-coller. */
const MAX_LENGTH = 1000;

/**
 * Au-delà de six intentions, on n'exécute pas en aveugle. Une phrase qui produit
 * dix écritures est plus probablement une transcription partie en vrille qu'un
 * parent particulièrement organisé (§4.5).
 */
const PER_BLOCK_THRESHOLD = 6;

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

  let sentence: unknown;
  try {
    sentence = ((await request.json()) as { phrase?: unknown }).phrase;
  } catch {
    return fail("Requête illisible.", 400);
  }
  if (typeof sentence !== "string" || !sentence.trim()) {
    return fail("Dites-nous ce qui s'est passé.", 400);
  }
  if (sentence.length > MAX_LENGTH) {
    return fail("C'est un peu long — dites-le en une ou deux phrases.", 400);
  }

  const cookieStore = await cookies();
  const loaded = await loadVoiceContext(
    cookieStore.get(ACTIVE_BABY_COOKIE)?.value,
  );
  if (!loaded) return fail("Aucun enfant dans ce foyer.", 400);

  let understanding;
  try {
    understanding = await understand(sentence.trim(), loaded.ctx);
  } catch (error) {
    // Le service de compréhension est le seul point de panne de la chaîne : on
    // le dit franchement, et l'écran du jour reste là pour saisir à la main.
    console.error("voice/understand:", error);
    return fail(
      "La compréhension n'a pas répondu. Réessayez dans un instant.",
      502,
    );
  }

  const intents = resolveIntents(understanding.intents, loaded.ctx);
  const total = Date.now() - start;

  // La latence est l'indicateur à instrumenter avant tout autre : au-delà de
  // cinq secondes après la phrase, la fonctionnalité est morte (§3.4).
  // Le modèle est journalisé avec elle : la fonctionnalité en accepte plusieurs,
  // et une latence sans le nom du modèle qui l'a produite ne se compare à rien.
  console.info(
    `[voice] ${total} ms (understanding ${understanding.latency} ms) · ` +
      `${intents.length} intent(s) · cache ${understanding.cacheRead} tokens · ` +
      `${understanding.model.id} effort ${understanding.model.effort}`,
  );

  const reply: VoiceReply = {
    transcript: sentence.trim(),
    answer: understanding.answer,
    intents,
    perBlockValidation: intents.length > PER_BLOCK_THRESHOLD,
    latency: { understanding: understanding.latency, total },
  };
  return Response.json(reply);
}
