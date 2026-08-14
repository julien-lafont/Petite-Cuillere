/**
 * The vocabulary of voice commands — server side and client side.
 *
 * Two families of types answer each other:
 *
 *   **raw**       what the model is allowed to say. Names and keywords, never an
 *                 id nor a computed date.
 *   **resolved**  what the app made of it: verified uuids, and dates the server
 *                 counted itself.
 *
 * The border between the two is the feature's guarantee: a fanciful
 * transcription cannot invent a peanut exposure, because it never handles a
 * food's id. See docs/feats/commande-vocale.md §4.4.
 */

import type { MealResult, MealStatus } from "@/lib/data/meals.types";

// ────────────────────────────────────────────────────────────────────────────
// The context handed to the model (§4.6)
// ────────────────────────────────────────────────────────────────────────────

export type MomentContext = {
  id: string;
  label: string;
  position: number;
  /** Start of the window, in minutes since local midnight (6am → 360). */
  startMinute: number;
  /** End of the window, exclusive (10am → 600). */
  endMinute: number;
};

export type FoodContext = {
  id: string;
  name: string;
  category: string | null;
  /** Usual introduction age, in months. */
  minAgeMonths: number | null;
  /** The catalogue's restriction sentence — the source of "can I…" answers. */
  restrictions: string | null;
  /** Label of the allergen carried, if any. */
  allergen: string | null;
};

export type BabyContext = {
  id: string;
  firstName: string;
  sexe: string | null;
  /** Effective age spelled out ("8 mois"). */
  ageLabel: string;
  ageMonths: number;
  /** The child on screen: the one we talk about by default. */
  active: boolean;
};

export type MealContext = {
  date: string;
  momentId: string;
  /** Food names, in meal order. */
  foods: string[];
  status: MealStatus;
  result: MealResult;
};

export type AllergenContext = {
  name: string;
  state: "confirmed" | "ongoing" | "planned";
  /** Date of the next planned exposure, if there is one. */
  date: string | null;
};

/**
 * Everything the model sees. Deliberately small — that is what holds cost and
 * latency down (§4.6). The full history, the statistics and the long-range
 * programme stay outside.
 */
export type VoiceContext = {
  /** Local timestamp of the dictation, "YYYY-MM-DDTHH:mm". */
  now: string;
  /** The same time, in minutes since midnight — the form the rules read. */
  nowMinutes: number;
  /** Day of the dictation, "YYYY-MM-DD". The model never computes it. */
  today: string;
  /** "vendredi" — to make sense of "samedi", "jeudi prochain". */
  weekday: string;
  babies: BabyContext[];
  moments: MomentContext[];
  foods: FoodContext[];
  /** Meals from D-2 to D+7. */
  meals: MealContext[];
  /** Foods already discovered and how many times they were served. */
  discovered: { name: string; exposures: number }[];
  allergens: AllergenContext[];
  shopping: { name: string; checked: boolean }[];
};

// ────────────────────────────────────────────────────────────────────────────
// Raw intents — what the model is allowed to say
// ────────────────────────────────────────────────────────────────────────────

/**
 * The model's date vocabulary: an enumeration, never a subtraction.
 *
 * A model that counts days gets it wrong one time in ten; a model that says
 * "hier" never does. The server resolves.
 *
 * The values are in French: they are prompt literals, not identifiers — the
 * model reasons in the language of the utterance (§4.4).
 */
export type DayKeyword =
  | "aujourd_hui"
  | "hier"
  | "avant_hier"
  | "demain"
  | "apres_demain"
  | "date_iso";

export type Appreciation = "bien" | "moyen" | "refuse";

/**
 * What the model may say about a meal it composes: a rating, or the admission
 * that the parent said nothing about it. The second only exists in the exchange
 * with the model — resolution turns it back into `null`.
 */
export type SpokenAppreciation = Appreciation | "non_dit";

/** A report ("il a mangé") or a forecast ("il mangera"): two different writes. */
export type Nature = "constat" | "prevision";

/**
 * The verb tense — what points at the slot when the parent does not name it.
 *
 * Not to be confused with `Nature`, which decides between logging the past and
 * locking an upcoming slot. The two do not overlap: "il mange des carottes ce
 * soir" is a present tense aimed at the future. Above all, `Nature` does not
 * tell "il mange" from "il mangera", and that is exactly where the 10:30
 * ambiguity plays out (docs/feats/creneaux-horaires.md §7.2).
 */
export type Tense = "passe" | "present" | "futur";

/** What places an intent in time, before resolution. */
type RawSlot = {
  jour?: DayKeyword;
  /** The tense the parent used. */
  temps?: Tense;
  /** Absolute date, when `jour` is `date_iso`. */
  date_iso?: string;
  /** Id of a household moment, picked from the list we sent. */
  moment_id?: string;
};

export type RawLogMeal = RawSlot & {
  enfant?: string;
  aliments: string[];
  appreciation: SpokenAppreciation;
  nature: Nature;
};

export type RawSkipMeal = RawSlot & {
  enfant?: string;
  /** Backing out: "finalement il a mangé". */
  annuler?: boolean;
};

export type RawRateMeal = RawSlot & {
  enfant?: string;
  appreciation: Appreciation;
};

export type RawSubstituteFood = RawSlot & {
  enfant?: string;
  aliment_absent: string;
  /** "non_dit" when the parent proposed nobody. */
  remplacant: string;
};

export type RawAskClarification = {
  question: string;
  options: string[];
};

export type RawIntent =
  | { tool: "noter_repas"; params: RawLogMeal }
  | { tool: "repas_non_donne"; params: RawSkipMeal }
  | { tool: "noter_appreciation"; params: RawRateMeal }
  | { tool: "remplacer_aliment"; params: RawSubstituteFood }
  | { tool: "demander_precision"; params: RawAskClarification };

export type ToolName = RawIntent["tool"];

// ────────────────────────────────────────────────────────────────────────────
// Resolved intents — what the app agrees to run
// ────────────────────────────────────────────────────────────────────────────

/**
 * A food the model named, once checked against the catalogue.
 *
 * `unknown` is not a failure: it is a proposal to create, which the parent
 * accepts or not. A silent write would be the real failure (§9.2).
 */
export type ResolvedFood =
  | {
      state: "resolved";
      id: string;
      name: string;
      /** What the model wrote — shown when resolution was approximate. */
      spoken: string;
      /** The match was not exact ("blanc de poirot" → "Blanc de poireau"). */
      approximate: boolean;
    }
  | { state: "unknown"; spoken: string };

/** The slot, once dates are counted and the moment verified. */
export type ResolvedSlot = {
  date: string;
  /** "aujourd'hui", "hier", "samedi 9 août" — for display. */
  dateLabel: string;
  momentId: string;
  momentLabel: string;
  /** The moment was not named: the app inferred it, and it stays editable. */
  momentInferred: boolean;
  /**
   * No slot imposes itself and the parent has to decide.
   *
   * The typical case: at 10:30, "he's having some apple". We are between
   * breakfast and lunch, and the present tense does not say which. The intent
   * goes out anyway — foods included — but `ready` is false and the moment
   * picker opens by itself. One tap, against a whole sentence to say again
   * (§7.4).
   */
  momentAmbiguous: boolean;
};

export type IntentDetail =
  | {
      type: "logMeal";
      slot: ResolvedSlot;
      foods: ResolvedFood[];
      appreciation: Appreciation | null;
      nature: Nature;
    }
  | { type: "skipMeal"; slot: ResolvedSlot; cancel: boolean }
  | { type: "rateMeal"; slot: ResolvedSlot; appreciation: Appreciation }
  | {
      type: "substituteFood";
      slot: ResolvedSlot;
      missing: ResolvedFood;
      replacement: ResolvedFood | null;
      /** Three substitutes offered when the parent named none (§4.2 of suivi réel). */
      substitutes: { id: string; name: string }[];
    }
  | { type: "askClarification"; question: string; options: string[] };

/**
 * An intent ready to be shown on the confirmation card.
 *
 * `ready` separates what a tap sends to the database from what still awaits a
 * decision. Valid intents survive invalid ones: rejecting a whole dictation
 * because one word is missing loses the parent (§4.5).
 */
export type ResolvedIntent = {
  /** Local key, stable for the life of a card. */
  key: string;
  /** The child meant — the active one by default. */
  babyId: string;
  babyName: string;
  ready: boolean;
  /** What is missing, worded for the parent. `null` when all is well. */
  issue: string | null;
  detail: IntentDetail;
};

// ────────────────────────────────────────────────────────────────────────────
// The route contract
// ────────────────────────────────────────────────────────────────────────────

export type VoiceReply = {
  /** The text understood. In batch 1, the one the parent typed. */
  transcript: string;
  /** Free text from the model: an answer to a question, or a polite refusal. */
  answer: string | null;
  intents: ResolvedIntent[];
  /**
   * Past six intents we do not run blind: the card asks for block-by-block
   * confirmation (§4.5).
   */
  perBlockValidation: boolean;
  /** Milliseconds. Latency is the number one metric to instrument (§3.4). */
  latency: { understanding: number; total: number };
  /**
   * Tokens read from the prompt cache. It surfaces here so it can go into the
   * `POST /api/voix/trace` trace: a repeated zero means the cache breakpoint is
   * broken, which costs both latency and money.
   */
  cacheRead: number;
};

export type VoiceError = { error: string };

/**
 * What `POST /api/voix/ecoute` answers: **the transcription mode, decided by
 * the server**.
 *
 * The server reads `VOICE_TRANSCRIPTION`, not the browser — a public variable
 * would freeze at build time, where this one changes without a redeploy. So the
 * browser asks "how do I listen?" before listening, and adapts its route:
 * streaming into an open session, or recording then posting to
 * `POST /api/voix/transcrire`.
 */
export type VoiceListenReply =
  { mode: "live"; url: string } | { mode: "pre-recorded" };

/**
 * What `POST /api/voix/transcrire` answers. The latency travels with the text
 * because the browser cannot tell it apart from the network: it is the time
 * spent at the transcriber, as the server saw it.
 */
export type VoiceTranscriptReply = { transcript: string; latency: number };
