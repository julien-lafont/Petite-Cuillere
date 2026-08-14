import type OpenAI from "openai";
import type {
  FunctionTool,
  Response,
  ResponseOutputItem,
} from "openai/resources/responses/responses";
import type { VoiceTool } from "@/lib/voice/tools";
import type { ToolCall, VoiceProvider } from "@/lib/voice/providers/types";

/**
 * OpenAI — the third provider, and the one `DEFAULT_MODEL` points at since the
 * §11 set settled it: `gpt-5.6-terra` at `low` is the only measured configuration
 * that wins on both accuracy and latency.
 *
 * Four substantive differences from the other two, all absorbed here:
 *
 * 1. **The API is the Responses API**, not a `messages.create`. Instructions have
 *    their own field (`instructions`) and the parent's message goes in `input`.
 * 2. **The cache has no marker**, as at Google: it applies automatically to the
 *    common prefix, from 1,024 tokens up. Hence the same concatenation of the two
 *    stable blocks at the head — their position, and nothing else, makes the
 *    cache.
 * 3. **Tool parameters arrive as a JSON string**, not an object. It is the only
 *    provider where the adapter has to parse, so the only one where a model can
 *    produce invalid JSON.
 * 4. **The output is a list of heterogeneous items** (`output`), not content in
 *    two shapes. Reasoning is an item like any other, which we leave aside.
 *
 * Effort passes through unchanged: `low` … `max` are exactly OpenAI's levels. Not
 * every model accepts all five — `xhigh` and `max` are reserved for the largest —
 * and a refused level is an error on the first call, not a silent downgrade.
 */

const MAX_TOKENS = 16000;

type JsonSchema = Record<string, unknown>;

/**
 * OpenAI's strict mode requires **every** key of `properties` to appear in
 * `required` — a merely omitted field fails the request at startup ("'required'
 * is required to be supplied and to be an array including every key in
 * properties"). Ours are not: `enfant`, `date_iso`, `moment_id` and `annuler` are
 * optional by design.
 *
 * The documented escape hatch is a union with `null`: the field becomes
 * required, and the model writes `null` when it has nothing to put there. For an
 * enum field, `null` must go **into the enumeration itself**, not just into the
 * type — otherwise the value `type` allows stays forbidden by `enum`. That is the
 * case for `moment_id`.
 *
 * The conversion lives here and not in `tools.ts`: it is one provider's
 * constraint, and `tools.ts` must stay the only place intents are described, with
 * nothing belonging to any of them. Resolution absorbs these `null`s unchanged —
 * it already handles absence wherever these fields are read, because a model that
 * fills an optional field badly was a case it had to cover anyway.
 */
function withNullableOptionals(schema: JsonSchema): JsonSchema {
  const properties = schema.properties as
    Record<string, JsonSchema> | undefined;
  if (!properties) return schema;

  const required = new Set((schema.required as string[] | undefined) ?? []);
  const rewritten: Record<string, JsonSchema> = {};

  for (const [name, property] of Object.entries(properties)) {
    const nested =
      property.type === "object" ? withNullableOptionals(property) : property;
    if (required.has(name)) {
      rewritten[name] = nested;
      continue;
    }
    rewritten[name] = {
      ...nested,
      type: [nested.type as string, "null"],
      ...(Array.isArray(nested.enum)
        ? { enum: [...nested.enum, null] }
        : undefined),
    };
  }

  return {
    ...schema,
    properties: rewritten,
    required: Object.keys(rewritten),
  };
}

/**
 * `strict: true` — same reason as at Anthropic: the parameters are then
 * guaranteed to conform to the schema, and `moment_id`, whose enumeration is the
 * household's, can hold neither another household's id nor an invented one. That
 * is what justifies converting the schema rather than giving up strict mode.
 */
function toFunctionTool(tool: VoiceTool): FunctionTool {
  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: withNullableOptionals(
      tool.parameters as JsonSchema,
    ) as FunctionTool["parameters"],
    strict: true,
  };
}

/**
 * The SDK is only loaded on use — see the note in the Anthropic adapter. The key
 * is read from the environment (`OPENAI_API_KEY`): no secret goes through the
 * code.
 */
let client: OpenAI | null = null;

async function openai(): Promise<OpenAI> {
  if (!client) {
    const sdk = await import("openai");
    client = new sdk.default();
  }
  return client;
}

/**
 * Arguments arrive as a string. Invalid JSON becomes `null` rather than an
 * exception: resolution rejects a parameter it does not recognise, and an
 * evaluation case should end in a readable failure, not in a whole pass falling
 * over.
 */
function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * A polite refusal is a `refusal` in the content; a cut-off is a status.
 * `max_output_tokens` is deliberately left out: as at Google, a truncated
 * response is not a refusal, and what it holds is still usable.
 */
function isRefusal(reply: Response, items: ResponseOutputItem[]): boolean {
  if (reply.status === "failed" || reply.status === "cancelled") return true;
  if (
    reply.incomplete_details?.reason !== undefined &&
    reply.incomplete_details.reason !== "max_output_tokens"
  ) {
    return true;
  }
  return items.some(
    (item) =>
      item.type === "message" &&
      item.content.some((part) => part.type === "refusal"),
  );
}

export const openaiProvider: VoiceProvider = {
  name: "openai",
  prefixes: ["gpt-", "o3", "o4"],
  credentials: ["OPENAI_API_KEY"],
  // `low`: on Terra, `medium` costs two cases and returns nothing. The numbers
  // are in `providers/index.ts`.
  defaultEffort: "low",

  async run({ model, instructions, catalog, message, tools }) {
    const reply = await (
      await openai()
    ).responses.create({
      model: model.id,
      // The two stable blocks, in order, at the head of the request: the
      // automatic cache only recognises the common prefix across dictations.
      instructions: `${instructions}\n\n${catalog}`,
      input: message,
      max_output_tokens: MAX_TOKENS,
      reasoning: { effort: model.effort },
      tools: tools.map(toFunctionTool),
      store: false,
    });

    const items = reply.output ?? [];
    const calls: ToolCall[] = [];
    const texts: string[] = [];

    for (const item of items) {
      if (item.type === "function_call") {
        calls.push({ name: item.name, params: parseArguments(item.arguments) });
      } else if (item.type === "message") {
        for (const part of item.content) {
          // Reasoning is a separate item, never an `output_text`: nothing to
          // filter here, unlike Gemini's `thought` parts.
          if (part.type === "output_text") texts.push(part.text);
        }
      }
    }

    return {
      calls,
      texts,
      refused: isRefusal(reply, items),
      cacheRead: reply.usage?.input_tokens_details?.cached_tokens ?? 0,
    };
  },
};
