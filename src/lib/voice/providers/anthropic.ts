import type Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { VoiceTool } from "@/lib/voice/tools";
import type {
  ProviderResult,
  VoiceProvider,
} from "@/lib/voice/providers/types";

/**
 * Anthropic — the reference provider, the one the §11 evaluation set was
 * calibrated on.
 *
 * Two settings are its own and have no equivalent elsewhere: the cache marker
 * placed by hand on the last system block, and fast mode.
 */

const MAX_TOKENS = 16000;

/**
 * The SDK is only loaded on use: the configured model uses one of the two, and
 * the other has no business sitting in memory in a server function.
 */
let client: Anthropic | null = null;

async function anthropic(): Promise<Anthropic> {
  if (!client) {
    const sdk = await import("@anthropic-ai/sdk");
    client = new sdk.default();
  }
  return client;
}

/**
 * Every tool is declared `strict`: its parameters are then guaranteed to conform
 * to the schema, and `moment_id` — whose enumeration is the household's — cannot
 * hold another household's id, nor an invented one.
 */
function toTool(tool: VoiceTool): Tool {
  return {
    name: tool.name,
    description: tool.description,
    strict: true,
    input_schema: tool.parameters,
  };
}

export const anthropicProvider: VoiceProvider = {
  name: "anthropic",
  prefixes: ["claude-"],
  credentials: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN"],
  // `low` is ruled out here and nowhere else: it is the only level on which
  // Opus 5 enumerates the `moment_id`s after refusing them (case J3).
  defaultEffort: "medium",

  async run({ model, instructions, catalog, message, tools }) {
    const request = {
      model: model.id,
      max_tokens: MAX_TOKENS,
      // Never turned off: on Opus 5, cutting thinking sometimes makes it write
      // the tool call as visible text — the tool is then never run, and nothing
      // flags it.
      thinking: { type: "adaptive" as const },
      output_config: { effort: model.effort },
      system: [
        { type: "text" as const, text: instructions },
        // The cache breakpoint is here, on the last system block: since the
        // render order is `tools → system → messages`, it caches the tools AND
        // the catalogue. Everything that changes — date, first name, the day's
        // meals — goes into the message, below.
        {
          type: "text" as const,
          text: catalog,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      tools: tools.map(toTool),
      messages: [{ role: "user" as const, content: message }],
    };

    // Fast mode — up to 2.5× output tokens per second, at twice the input price.
    // It is the only lever aimed at this feature's real problem: latency is at
    // twice the §3.4 budget, and reasoning is not what we can shave without
    // losing accuracy. It lives on the beta endpoint, as a research preview, on
    // the Claude API only — the body is the same on both sides, only the route
    // changes.
    const reply = model.fast
      ? await (
          await anthropic()
        ).beta.messages.create({
          ...request,
          speed: "fast",
          betas: ["fast-mode-2026-02-01"],
        })
      : await (await anthropic()).messages.create(request);

    const result: ProviderResult = {
      calls: [],
      texts: [],
      refused: reply.stop_reason === "refusal",
      cacheRead: reply.usage.cache_read_input_tokens ?? 0,
    };

    for (const block of reply.content) {
      if (block.type === "text") {
        result.texts.push(block.text);
      } else if (block.type === "tool_use") {
        result.calls.push({ name: block.name, params: block.input });
      }
    }
    return result;
  },
};
