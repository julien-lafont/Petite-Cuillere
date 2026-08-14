import type { VoiceContext } from "@/lib/voice/types";

/**
 * The household lexicon, pushed to the transcription engine (§4.2.2).
 *
 * A household hands us a closed vocabulary for free — one first name, sixty
 * foods — and matching is **phonetic**, not textual: we describe what we risk
 * hearing, not what we want to read.
 *
 * **This file is smaller than §4.2.2 planned, and that is a measured result, not
 * an oversight.** On real dictations, every added term corrects less than it
 * breaks as soon as it resembles a common word:
 *
 *   · "Léa" in the lexicon turned "**il a** mangé des poireaux" into "**Léa**
 *     mangé des poireaux". Hence `MIN_LENGTH`;
 *   · moment labels — "Goûter", "Dîner" — turned "il a **goûté**" into "il a
 *     **Goûter**". They are nouns spelled like verbs: the lexicon flattens the
 *     conjugation. They are out;
 *   · command verbs, out for the same reason, with nothing gained in return.
 *
 * What remains is the first name, the allergens and the catalogue: the words the
 * engine cannot guess. A lexicon is a lexicon, not a dictionary — and the engine
 * writes the words everyone knows perfectly well on its own.
 */

export type Term = {
  value: string;
  /** Spellings as we risk hearing them — the match is phonetic. */
  variants?: string[];
  /** 0.4 to 0.6. Above that, the engine sees "panais" everywhere. */
  intensity?: number;
};

/**
 * The lexicon cap. Gladia's documentation sets none, but match quality does: the
 * longer the list, the more the engine pulls together words that have nothing to
 * do with each other. ~80 entries cover a full household, catalogue included —
 * this is the setting to watch (§4.2.2).
 */
const MAX_TERMS = 80;

/**
 * A first name is the word most often mangled, and the one that decides which
 * child we are talking about: it deserves a stronger match than the rest.
 *
 * Without illusions, though: "Mathis" still comes back as "Maty", and raising it
 * to 0.75 changes nothing — only `variants`, which we cannot invent for an
 * arbitrary name, would catch it. So we stay at the recommended cap, and lean on
 * the fact that an unrecognised name falls back to the active child
 * (`resolveBaby`) rather than pointing at the wrong one.
 */
const NAME_INTENSITY = 0.6;

/**
 * Below four letters a phonetic term attracts everything that goes past. Not a
 * theoretical precaution: with "Léa" in the lexicon, "**il a** mangé des
 * poireaux" came back as "**Léa** mangé des poireaux". The rule holds for names
 * as for the rest — a short name is precisely the one that sounds most like an
 * ordinary syllable, so the most dangerous.
 *
 * What those words lose in correction they gain in quiet: an engine writes them
 * fine on its own, they are not the ones we came to fix.
 */
const MIN_LENGTH = 4;

/**
 * Builds a household's lexicon, most decisive term first.
 *
 * The order is the trade-off: if the cap bites, the foods never served go first,
 * never the child's name nor an allergen.
 */
export function buildLexicon(ctx: VoiceContext): Term[] {
  const terms: Term[] = [];
  const seen = new Set<string>();

  const add = (value: string, term?: Omit<Term, "value">) => {
    const clean = value.trim();
    const key = clean.toLocaleLowerCase("fr-FR");
    if (clean.length < MIN_LENGTH || seen.has(key)) return;
    seen.add(key);
    terms.push({ value: clean, ...term });
  };

  // 1. The household's first names. Out of distribution by nature.
  for (const baby of ctx.babies) {
    add(baby.firstName, { intensity: NAME_INTENSITY });
  }

  // 2. Allergens. Safety vocabulary: a mix-up is expensive.
  for (const food of ctx.foods) if (food.allergen) add(food.allergen);

  // 3. Foods already served. They are the ones that come up again: the
  //    programme revolves around them, and the parent names them weekly.
  for (const { name } of ctx.discovered) add(name);

  // 4. The rest of the catalogue, while there is room.
  for (const food of ctx.foods) add(food.name);

  return terms.slice(0, MAX_TERMS);
}
