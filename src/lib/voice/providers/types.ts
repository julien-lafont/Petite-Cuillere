import type { VoiceTool } from "@/lib/voice/tools";

/**
 * The contract of an understanding provider.
 *
 * Understanding is the batch's only external dependency, and the one that moves
 * fastest: a model ships every three months, and the right setting is measured
 * rather than guessed (§3.5, decision 2). So the rest of the code must never
 * learn the provider's name — it asks "understand this sentence", it gets raw
 * intents back.
 *
 * What a provider receives is deliberately thin: two stable blocks, one volatile
 * block, and a tool list described in JSON Schema. Everything specific —
 * Anthropic's cache marker, Google's `thinkingLevel` — lives in the adapter, not
 * here.
 */

/**
 * Reasoning depth, in Anthropic's vocabulary because it is the finer-grained of
 * the two. Each adapter translates it into its own.
 */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export type ProviderName = "anthropic" | "google" | "openai";

/** A configured model: who hosts it, and with which settings we call it. */
export type VoiceModel = {
  /** The id as written in `VOICE_MODEL`. */
  id: string;
  provider: ProviderName;
  effort: Effort;
  /** Fast mode — Anthropic only, ignored elsewhere. */
  fast: boolean;
};

/** An understanding request, stated once for every model. */
export type UnderstandRequest = {
  model: VoiceModel;
  /** Stable block 1: the instructions. */
  instructions: string;
  /** Stable block 2: the household catalogue. The cache breakpoint is after it. */
  catalog: string;
  /** The volatile block: the date, the day's meals, the parent's sentence. */
  message: string;
  tools: VoiceTool[];
};

export type ToolCall = {
  name: string;
  /** The parameters exactly as the model wrote them. Resolution checks them. */
  params: unknown;
};

export type ProviderResult = {
  calls: ToolCall[];
  /** The free-text blocks, reasoning excluded. */
  texts: string[];
  /**
   * The model declined. Handle before reading the content: a refusal returns a
   * 200 whose content may be empty.
   */
  refused: boolean;
  /** Tokens read from the prompt cache: a repeated zero = broken cache breakpoint. */
  cacheRead: number;
};

export type VoiceProvider = {
  name: ProviderName;
  /** The id prefixes that mark this provider ("claude-"). */
  prefixes: string[];
  /** The environment variables of which at least one must carry a key. */
  credentials: string[];
  /**
   * The effort used when `VOICE_EFFORT` says nothing — the one the §11 test set
   * picked for that provider.
   *
   * It lives here rather than as a single constant because the right level does
   * not travel between models: `low` is the best setting at Google and the only
   * dangerous one at Anthropic (case J3). A global default would reopen that leak
   * on the first change of `VOICE_MODEL`.
   */
  defaultEffort: Effort;
  run(request: UnderstandRequest): Promise<ProviderResult>;
};
