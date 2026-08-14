import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BABY_COOKIE } from "@/lib/data/baby";
import { loadVoiceContext } from "@/lib/voice/load";
import { understand } from "@/lib/voice/understand";
import { resolveIntents } from "@/lib/voice/resolution";
import { refuseIfOverQuota } from "@/lib/voice/quota";
import type { VoiceError, VoiceReply } from "@/lib/voice/types";

/**
 * `POST /api/voix` — understand, never write.
 *
 * Five steps, in this order: authentication, context, understanding, server-side
 * validation, response. **No database write starts here.** The model describes
 * an action, it runs none: that cut is what guarantees the rules written in
 * `program/` and `meal-reality.actions.ts` stay the sole authority, and that a
 * fanciful transcription cannot invent a peanut exposure (§4.1, decision A).
 *
 * Writing goes through `executeOrders` — after a tap from the parent.
 */

/** Past this, it is no longer a dictation: it is a paste. */
const MAX_LENGTH = 1000;

/**
 * Past six intents we do not run blind. A sentence producing ten writes is more
 * likely a transcription gone off the rails than a particularly organised parent
 * (§4.5).
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

  // Charged before any work, and after the checks that cost nothing: what we
  // are protecting is the model call, not the malformed phrase.
  const refused = await refuseIfOverQuota(supabase);
  if (refused) return refused;

  const cookieStore = await cookies();
  const loaded = await loadVoiceContext(
    cookieStore.get(ACTIVE_BABY_COOKIE)?.value,
  );
  if (!loaded) return fail("Aucun enfant dans ce foyer.", 400);

  let understanding;
  try {
    understanding = await understand(sentence.trim(), loaded.ctx);
  } catch (error) {
    // The understanding service is the chain's only point of failure: we say so
    // plainly, and the day screen is still there for entering things by hand.
    console.error("voice/understand:", error);
    return fail(
      "La compréhension n'a pas répondu. Réessayez dans un instant.",
      502,
    );
  }

  const intents = resolveIntents(understanding.intents, loaded.ctx);
  const total = Date.now() - start;

  // Latency is the metric to instrument before any other: past five seconds
  // after the sentence, the feature is dead (§3.4). The model is logged with
  // it: the feature accepts several, and a latency without the name of the
  // model that produced it compares to nothing.
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
    cacheRead: understanding.cacheRead,
  };
  return Response.json(reply);
}
