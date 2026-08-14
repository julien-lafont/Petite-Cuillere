/**
 * What real life imposes on the plan — PURE LOGIC (no I/O).
 * See docs/feats/suivi-reel-et-rattrapage.md.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE TRUST ASYMMETRY
 *
 * A past meal left as "prévu" is ambiguous: maybe the parent typed nothing, or
 * maybe the child ate nothing. We decide differently depending on what being
 * wrong costs.
 *
 *   DISCOVERY — presumed done. Being wrong costs little: the food comes back in
 *     the rotation. Stalling the programme on a silent parent would cost the
 *     whole product.
 *   ALLERGEN — not confirmed. Being wrong would mean believing the child
 *     protected when they never touched peanut. The cost is harm to health, so
 *     we require explicit confirmation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PICKING UP FROM THE GENERATOR
 *
 * `buildPlan` moves forward holding two things from one day to the next: the
 * discovery to repeat tomorrow, and the allergen whose ramp-up dose is still to
 * serve. Replanning mid-course means picking those two threads back up where
 * reality left them — which is the whole point of `PlanReality`.
 */

import { addDays, toISODate } from "@/lib/dates";

/** A real meal, cut down to what the derivation needs. */
export type RealMeal = {
  date: string;
  momentId: string | null;
  status: "prevu" | "servi" | "remplace" | "saute";
  locked: boolean;
  result: "bien" | "moyen" | "refuse" | null;
  items: {
    foodId: string;
    skipped: boolean;
    /** Allergen this food carries, if any. */
    allergenId: string | null;
    /** A prescribed dose marks a protocol step, not an ordinary food. */
    dose: string | null;
  }[];
  /** Allergènes explicitement rattachés au repas (`meal_allergens`). */
  allergenIds: string[];
};

/** What reality imposes on the upcoming plan. Every entry is optional. */
export type PlanReality = {
  /** Découverte de la veille encore à répéter aujourd'hui (R2). */
  repeatToday?: string | null;
  /** Allergen whose ramp-up dose is still owed (R7). */
  pendingAllergen?: { allergenId: string; foodId: string } | null;
  /** Slots fixed by the parent: never rewritten, but taken into account (R12). */
  locked?: { date: string; momentId: string; foodIds: string[] }[];
  /** Days of interruption to subtract from the elapsed time (R11). */
  interruptionDays?: number;
};

/** Full starting state for a replan. */
export type DerivedState = {
  /** Foods treated as known to the child (presumption included). */
  introducedFoodIds: string[];
  /** Allergens actually confirmed — the only basis the protocol accepts. */
  confirmedAllergenIds: string[];
  /**
   * Allergens seen in the programme but never confirmed, with a count. Past
   * `MAX_ALLERGEN_RETRIES`, the programme stops offering them and flags them to
   * the parent rather than looping forever (R6).
   */
  unconfirmedAllergens: { allergenId: string; attempts: number }[];
  /**
   * Allergens the programme stops offering for lack of confirmation. They join
   * maintenance — so they keep being served, which does expose the child — but
   * show as "à confirmer" in Discoveries: the product never claims to know what
   * it does not.
   */
  unconfirmedGiveUpIds: string[];
  reality: PlanReality;
};

/**
 * How many times an unconfirmed allergen is offered again before the programme
 * moves on. One retry, no more: without this cap, a parent who never confirms
 * would stall the calendar on egg.
 */
export const MAX_ALLERGEN_RETRIES = 1;

/**
 * How many consecutive days with no confirmed solid before we treat
 * diversification as interrupted (R11).
 */
export const INTERRUPTION_MIN_DAYS = 7;

const asDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).getTime() / 86_400_000;

/**
 * Derives from the real history everything `buildPlan` needs to pick the thread
 * back up from `fromISO` (excluded from the past, it is the first day to
 * generate).
 *
 * @param meals    every known meal, past and upcoming
 * @param fromISO  first day the replan will write
 */
export function deriveState(
  meals: RealMeal[],
  fromISO: string,
  options: {
    /** Foods declared known at sign-up catch-up. */
    priorIntroduced?: string[];
    /** Allergens declared met at sign-up catch-up. */
    priorAllergens?: string[];
    /** Date of the first solid food, to bound the interruption search. */
    diversificationStartedOn?: string | null;
  } = {},
): DerivedState {
  const past = meals
    .filter((m) => m.date < fromISO && m.momentId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const introduced = new Set(options.priorIntroduced ?? []);
  const confirmedAllergens = new Set(options.priorAllergens ?? []);
  const allergenAttempts = new Map<string, number>();

  for (const meal of past) {
    // A meal that was not given exposed nothing at all.
    if (meal.status === "saute") {
      for (const id of meal.allergenIds) bump(allergenAttempts, id);
      continue;
    }

    for (const item of meal.items) {
      if (item.skipped) continue;
      introduced.add(item.foodId);
    }

    // Allergens: confirmation required. An unticked item does not count either,
    // even if the rest of the meal was eaten.
    const servedAllergens = new Set(
      meal.items
        .filter((it) => !it.skipped && it.allergenId)
        .map((it) => it.allergenId!),
    );
    for (const id of meal.allergenIds) {
      const confirmed =
        (meal.status === "servi" || meal.status === "remplace") &&
        // The `meal_allergens` link can outlive the removal of its carrier:
        // with no carrier food served, there was no exposure.
        (servedAllergens.has(id) || meal.items.every((it) => !it.allergenId));
      if (confirmed) confirmedAllergens.add(id);
      else bump(allergenAttempts, id);
    }
  }

  const unconfirmed = [...allergenAttempts.entries()]
    .filter(([id]) => !confirmedAllergens.has(id))
    .map(([allergenId, attempts]) => ({ allergenId, attempts }));

  return {
    introducedFoodIds: [...introduced],
    confirmedAllergenIds: [...confirmedAllergens],
    unconfirmedAllergens: unconfirmed,
    unconfirmedGiveUpIds: unconfirmed
      .filter((u) => u.attempts > MAX_ALLERGEN_RETRIES)
      .map((u) => u.allergenId),
    reality: {
      repeatToday: pendingRepeat(past, introduced, fromISO),
      pendingAllergen: pendingAllergenMonte(past, confirmedAllergens, fromISO),
      locked: lockedSlots(meals, fromISO),
      interruptionDays: interruptionDays(
        past,
        options.diversificationStartedOn ?? null,
        fromISO,
      ),
    },
  };
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Yesterday's discovery to offer again today (R2 and R5).
 *
 * The guide wants every new food served two days running. So we look for what
 * was tasted for the first time yesterday and not the day before — whether the
 * programme or the parent put it there, and whether the child loved it or
 * refused it: a refusal shifts nothing (decision G).
 */
function pendingRepeat(
  past: RealMeal[],
  introduced: Set<string>,
  fromISO: string,
): string | null {
  const yesterday = toISODate(addDays(new Date(`${fromISO}T00:00:00`), -1));
  const eatenOn = (dateISO: string) =>
    new Set(
      past
        .filter((m) => m.date === dateISO && m.status !== "saute")
        .flatMap((m) => m.items.filter((it) => !it.skipped))
        .map((it) => it.foodId),
    );

  const yesterdayFoods = eatenOn(yesterday);
  if (yesterdayFoods.size === 0) return null;

  // "New yesterday" = eaten yesterday, never before. We walk the whole history:
  // trusting the last two days would make a rotation food repeat.
  const before = new Set(
    past
      .filter((m) => m.date < yesterday && m.status !== "saute")
      .flatMap((m) => m.items.filter((it) => !it.skipped))
      .map((it) => it.foodId),
  );

  for (const id of yesterdayFoods) {
    if (!before.has(id) && introduced.has(id)) return id;
  }
  return null;
}

/**
 * The allergen whose ramp-up dose is still owed (R7 and R8).
 *
 * The protocol fits in two days: a knife tip, then the target dose. If the
 * second day did not happen, we do not restart from the test — the tolerated
 * threshold is banked, and redoing the low step would delay everyone without
 * protecting anything more.
 *
 * We go by the **number of confirmed exposures**, not by the presence of a
 * prescribed dose: an egg given outside the programme by the parent has no dose
 * in the database, and must still trigger the ramp-up exactly as if it had been
 * planned (R8).
 */
function pendingAllergenMonte(
  past: RealMeal[],
  confirmed: Set<string>,
  fromISO: string,
): { allergenId: string; foodId: string } | null {
  const from = asDay(fromISO);

  // Confirmed exposures per allergen: how many, when, and through which carrier.
  const seen = new Map<
    string,
    { count: number; lastDate: string; foodId: string }
  >();
  for (const meal of past) {
    if (meal.status !== "servi" && meal.status !== "remplace") continue;
    for (const item of meal.items) {
      if (item.skipped || !item.allergenId) continue;
      const cur = seen.get(item.allergenId);
      if (cur) {
        cur.count += 1;
        if (meal.date >= cur.lastDate) {
          cur.lastDate = meal.date;
          cur.foodId = item.foodId;
        }
      } else {
        seen.set(item.allergenId, {
          count: 1,
          lastDate: meal.date,
          foodId: item.foodId,
        });
      }
    }
  }

  for (const [allergenId, info] of seen) {
    if (!confirmed.has(allergenId)) continue;
    // A single, very recent exposure: the test happened, the ramp-up did not.
    // Past two days the ramp-up makes no sense — maintenance takes over and will
    // bring the allergen back on its own.
    if (info.count !== 1) continue;
    if (from - asDay(info.lastDate) > 2) continue;
    return { allergenId, foodId: info.foodId };
  }
  return null;
}

/**
 * The slots the parent fixed themselves from `fromISO` on. The engine does not
 * rewrite them, but must know them: without that the rotation would offer the
 * same food again the next day, and a discovery made by the parent would be
 * counted twice.
 *
 * A locked, empty meal ("we won't be there") is a constraint in its own right:
 * it occupies the slot without putting anything in it.
 */
function lockedSlots(
  meals: RealMeal[],
  fromISO: string,
): { date: string; momentId: string; foodIds: string[] }[] {
  return meals
    .filter(
      (m) =>
        m.date >= fromISO && m.momentId && (m.locked || m.status === "saute"),
    )
    .map((m) => ({
      date: m.date,
      momentId: m.momentId!,
      foodIds:
        m.status === "saute"
          ? []
          : m.items.filter((it) => !it.skipped).map((it) => it.foodId),
    }));
}

/**
 * Days of interruption to subtract from the elapsed time (R11).
 *
 * A child who ate no solids for three weeks is not three weeks more
 * experienced. We only count long, closed gaps — a two-day absence is part of
 * normal life, and the gap still running is not yet a settled fact.
 */
function interruptionDays(
  past: RealMeal[],
  startedOn: string | null,
  fromISO: string,
): number {
  const eaten = [
    ...new Set(
      past
        .filter(
          (m) => m.status !== "saute" && m.items.some((it) => !it.skipped),
        )
        .map((m) => m.date),
    ),
  ].sort();
  if (eaten.length === 0) return 0;

  const marks =
    startedOn && startedOn < eaten[0] ? [startedOn, ...eaten] : eaten;
  let total = 0;
  for (let i = 1; i < marks.length; i++) {
    const gap = asDay(marks[i]) - asDay(marks[i - 1]) - 1;
    if (gap >= INTERRUPTION_MIN_DAYS) total += gap;
  }
  // The current gap (from the last real meal to today) counts too: that is
  // exactly the return from holiday we want to cushion.
  const trailing = asDay(fromISO) - asDay(marks[marks.length - 1]) - 1;
  if (trailing >= INTERRUPTION_MIN_DAYS) total += trailing;

  return Math.round(total);
}
