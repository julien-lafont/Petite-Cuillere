import { INSTRUCTIONS, catalogBlock, todayBlock } from "@/lib/voice/context";
import { toolsFor } from "@/lib/voice/tools";
import { providerFor, resolveModel } from "@/lib/voice/providers";
import type { VoiceModel } from "@/lib/voice/providers/types";
import type { RawIntent, ToolName, VoiceContext } from "@/lib/voice/types";

/**
 * Understanding — this batch's only external dependency, isolated behind one
 * function.
 *
 * One round trip, one answer, done. No agent, no tool loop: an agentic loop
 * would cost five more seconds for a power we do not want — the model must have
 * no access to the database (§4.1, decision F).
 *
 * This file knows no provider. It assembles the three context blocks, calls the
 * configured model's adapter (`src/lib/voice/providers`) and sorts what comes
 * back. Changing model is an environment variable, not a code change.
 */

export type Understanding = {
  intents: RawIntent[];
  /** Free text: the answer to a question, or a polite refusal. */
  answer: string | null;
  /** Milliseconds spent in the call — the metric to watch (§3.4). */
  latency: number;
  /** Tokens read from the prompt cache: a repeated zero = broken cache breakpoint. */
  cacheRead: number;
  /** The model that answered — to log, or a measurement means nothing. */
  model: VoiceModel;
};

const KNOWN_TOOLS = new Set<ToolName>([
  "noter_repas",
  "repas_non_donne",
  "noter_appreciation",
  "remplacer_aliment",
  "demander_precision",
]);

/**
 * The fallback when the model declines. It should never happen on this domain,
 * but a direct read of the first content block would crash the day it does.
 */
const REFUSAL_ANSWER =
  "Je n'ai pas pu traiter cette phrase. Reformulez-la, ou notez le repas depuis l'écran du jour.";

export async function understand(
  sentence: string,
  ctx: VoiceContext,
  model: VoiceModel = resolveModel(),
): Promise<Understanding> {
  const start = Date.now();

  const result = await providerFor(model.id).run({
    model,
    instructions: INSTRUCTIONS,
    catalog: catalogBlock(ctx),
    message: `${todayBlock(ctx)}\n\n# Ce que le parent vient de dire\n\n${sentence}`,
    tools: toolsFor(ctx.moments),
  });

  const latency = Date.now() - start;

  if (result.refused) {
    return {
      intents: [],
      answer: REFUSAL_ANSWER,
      latency,
      cacheRead: result.cacheRead,
      model,
    };
  }

  const intents: RawIntent[] = [];
  for (const call of result.calls) {
    // A tool we do not know is a tool we will not run: its parameters then
    // have no reference schema, hence no guarantee.
    if (!KNOWN_TOOLS.has(call.name as ToolName)) continue;
    intents.push({
      tool: call.name as ToolName,
      // The schema is guaranteed conformant on the model side; resolution checks
      // everything else.
      params: call.params as never,
    });
  }

  return {
    intents,
    // No tool called = it was a question, and the free text IS the answer. No
    // "type: question" branch to invent (§4.3).
    answer: result.texts.join("\n").trim() || null,
    latency,
    cacheRead: result.cacheRead,
    model,
  };
}
