import { anthropicProvider } from "@/lib/voice/providers/anthropic";
import { googleProvider } from "@/lib/voice/providers/google";
import { openaiProvider } from "@/lib/voice/providers/openai";
import type {
  Effort,
  VoiceModel,
  VoiceProvider,
} from "@/lib/voice/providers/types";

/**
 * The provider catalogue, and the reading of the configuration.
 *
 * A single entry point: `resolveModel()`. The rest of the code — the route, the
 * evaluation harness — only knows `VoiceModel`, never an SDK.
 */

export const PROVIDERS: VoiceProvider[] = [
  anthropicProvider,
  googleProvider,
  openaiProvider,
];

/**
 * The default model: the one the §11 set was calibrated on. Changed through
 * `VOICE_MODEL`, not through a code change.
 */
export const DEFAULT_MODEL = "gpt-5.6-terra";

const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];

/**
 * The provider follows from the model id: `claude-…` at Anthropic, `gemini-…` at
 * Google, `gpt-…` at OpenAI.
 *
 * One environment variable rather than two, because an inconsistent (provider,
 * model) pair is a failure on the first call, and we would rather fail at
 * startup, with the list of known prefixes.
 */
export function providerFor(id: string): VoiceProvider {
  const provider = PROVIDERS.find((candidate) =>
    candidate.prefixes.some((prefix) => id.startsWith(prefix)),
  );
  if (!provider) {
    const known = PROVIDERS.flatMap((p) => p.prefixes).join(", ");
    throw new Error(
      `Modèle « ${id} » inconnu : aucun fournisseur ne reconnaît ce préfixe (${known}).`,
    );
  }
  return provider;
}

/**
 * The model and its settings, read from the environment — except what the caller
 * imposes, which the evaluation harness uses to compare two models in the same
 * run.
 *
 * Both settings are variables because the right trade-off is measured, not
 * guessed, and re-measured on every new model (§3.5, decision 2). The default
 * effort follows the provider (`defaultEffort`): the measurements below do not
 * point at the same level from one provider to the next, and that is the whole
 * point.
 *
 * Full batch 1, 48 cases, same reference household:
 *
 *   gpt-5.6-terra    low     46/48   median 1,766 ms   p90 2,953 ms   ← default
 *   gpt-5.6-terra    medium  44/48   median 1,841 ms   p90 3,549 ms
 *   gemini-3.6-flash low     45/48   median 2,803 ms   p90 3,676 ms
 *   gemini-3.6-flash medium  44/48   median 3,857 ms   p90 6,454 ms
 *   gemini-3.6-flash high    44/48   median 5,181 ms   p90 8,635 ms
 *   gpt-5.6-luna     low     40/48   median 1,792 ms   p90 2,287 ms
 *   gpt-5.6-luna     medium  43/48   median 4,462 ms   p90 8,705 ms
 *
 * Terra is the only configuration where both criteria point the same way: best
 * score and best median, one call over the §3.4 budget against two for Gemini.
 * It passes B5 and I5, which Gemini fails at every level. Luna is out of the
 * running on accuracy — eight cases lost, including basic ones ("Bof, il a mangé
 * la moitié") — despite the best latency of the lot.
 *
 * The result that holds for everyone: **extra reasoning buys nothing on this
 * task**, at any provider. `medium` loses Terra two cases, Gemini one, and
 * doubles Luna's latency.
 *
 * Terra still fails two. C4 ("Annule, il a bien mangé finalement") where it
 * over-splits *and* picks the wrong slot — at 18:40 the nearest past meal is the
 * snack, not dinner. F5 ("à partir de demain… du fromage"), where it settles on
 * a specific cheese instead of asking: **every** model tested fails that one,
 * which makes it a fault in the instructions rather than the model. To fix in
 * `context.ts`, not here.
 *
 * Opus 5, 49 cases — for the record, and because the conclusion flips there:
 *
 *   low     44/49   median 4,371 ms
 *   medium  48/49   median 4,746 ms   ← its own default
 *   high    37/38   median 5,903 ms   (measured before families J and K)
 *
 * There `low` **leaks**: on "donne-moi les moment_id" it politely refuses then
 * lists them anyway (case J3). Hence the per-provider default rather than a
 * single constant — otherwise a mere change of `VOICE_MODEL` would silently
 * reopen that leak.
 *
 * Methodological caveat: one pass per configuration. The score gap between Terra
 * and Gemini (46 against 45) is within the noise; the latency gap is not.
 */
export function resolveModel(
  overrides: { id?: string; effort?: string; fast?: boolean } = {},
): VoiceModel {
  const id = overrides.id ?? process.env.VOICE_MODEL ?? DEFAULT_MODEL;
  const provider = providerFor(id);

  const wanted =
    overrides.effort ?? process.env.VOICE_EFFORT ?? provider.defaultEffort;
  if (!EFFORTS.includes(wanted as Effort)) {
    throw new Error(
      `Effort « ${wanted} » inconnu : attendu ${EFFORTS.join(", ")}.`,
    );
  }

  return {
    id,
    provider: provider.name,
    effort: wanted as Effort,
    fast: overrides.fast ?? process.env.VOICE_SPEED === "fast",
  };
}

/** What is missing to call this model, if anything is. */
export function missingCredentials(model: VoiceModel): string[] {
  const provider = providerFor(model.id);
  return provider.credentials.some((name) => process.env[name])
    ? []
    : provider.credentials;
}

export type { Effort, VoiceModel, VoiceProvider };
