import type {
  FunctionDeclaration,
  GenerateContentResponse,
  GoogleGenAI,
} from "@google/genai";
import type { VoiceTool } from "@/lib/voice/tools";
import type { Effort, VoiceProvider } from "@/lib/voice/providers/types";

/**
 * Google — the second implementation, and the proof that the provider layer is
 * not decorative plumbing.
 *
 * Three substantive differences from Anthropic, all absorbed here:
 *
 * 1. **The cache has no marker.** Gemini implicitly caches the common prefix of
 *    two successive requests, unasked. Hence concatenating the two stable blocks
 *    into `systemInstruction`: their position at the head of the request, and
 *    nothing else, is what makes the cache. The counter stays readable
 *    (`cachedContentTokenCount`).
 * 2. **Reasoning is set in levels**, not as a continuous effort.
 * 3. **A refusal is a `finishReason`**, not a `stop_reason`.
 *
 * `VOICE_MODEL` expects a Gemini 3 or newer model here: `thinkingLevel` does not
 * exist before that (2.5 tunes with `thinkingBudget`, a different unit).
 */

const MAX_TOKENS = 16000;

/**
 * Effort, translated into levels. Gemini has only four: `xhigh` and `max` fall
 * back to `HIGH`, the highest it knows.
 */
const THINKING_LEVEL: Record<Effort, "MINIMAL" | "LOW" | "MEDIUM" | "HIGH"> = {
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  xhigh: "HIGH",
  max: "HIGH",
};

/**
 * Everything that is not a normal finish. `MALFORMED_FUNCTION_CALL` sits here on
 * purpose: the model produced nothing usable, and telling the parent beats
 * showing them an empty card.
 */
const NORMAL_FINISH = new Set([
  "STOP",
  "MAX_TOKENS",
  "FINISH_REASON_UNSPECIFIED",
]);

/**
 * The SDK is only loaded on use — see the note in the Anthropic adapter. We keep
 * the module itself and not just the client: `ThinkingLevel` is a TypeScript
 * enum, so a value, which an `import type` does not bring.
 */
type Sdk = typeof import("@google/genai");

let sdk: Sdk | null = null;
let client: GoogleGenAI | null = null;

async function google(): Promise<{ sdk: Sdk; client: GoogleGenAI }> {
  sdk ??= await import("@google/genai");
  // The key is read from the environment (`GEMINI_API_KEY`), as at Anthropic:
  // no secret goes through the code.
  client ??= new sdk.GoogleGenAI({});
  return { sdk, client };
}

/**
 * `parametersJsonSchema` rather than `parameters`: it takes the JSON Schema as
 * is, enumerations and `additionalProperties: false` included, where `parameters`
 * would force rewriting every field in the SDK's OpenAPI dialect. That is what
 * lets `tools.ts` stay the only place intents are described.
 */
function toFunctionDeclaration(tool: VoiceTool): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parametersJsonSchema: tool.parameters,
  };
}

/**
 * The visible text, reasoning excluded: thought parts carry `thought: true` and
 * have no business in the answer to the parent.
 */
function visibleTexts(reply: GenerateContentResponse): string[] {
  const parts = reply.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text as string);
}

export const googleProvider: VoiceProvider = {
  name: "google",
  prefixes: ["gemini-"],
  credentials: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  // `LOW`: extra reasoning buys nothing here, and costs the §3.4 budget. The
  // numbers are in `providers/index.ts`.
  defaultEffort: "low",

  async run({ model, instructions, catalog, message, tools }) {
    const { sdk, client } = await google();

    const reply = await client.models.generateContent({
      model: model.id,
      contents: message,
      config: {
        // The two stable blocks, in order, at the head of the request: that
        // prefix is what the implicit cache recognises from one dictation to the
        // next.
        systemInstruction: `${instructions}\n\n${catalog}`,
        maxOutputTokens: MAX_TOKENS,
        thinkingConfig: {
          thinkingLevel: sdk.ThinkingLevel[THINKING_LEVEL[model.effort]],
        },
        tools: [{ functionDeclarations: tools.map(toFunctionDeclaration) }],
      },
    });

    const finish = reply.candidates?.[0]?.finishReason;

    return {
      calls: (reply.functionCalls ?? []).map((call) => ({
        name: call.name ?? "",
        params: call.args,
      })),
      texts: visibleTexts(reply),
      refused:
        // A prompt blocked upstream does not even produce a candidate.
        reply.promptFeedback?.blockReason !== undefined ||
        (finish !== undefined && !NORMAL_FINISH.has(finish)),
      cacheRead: reply.usageMetadata?.cachedContentTokenCount ?? 0,
    };
  },
};
