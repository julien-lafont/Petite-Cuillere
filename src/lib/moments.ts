/**
 * Meal slots — PURE LOGIC, single source.
 *
 * A meal moment occupies a `[start, end[` window of the local day. Three rules,
 * and nothing else to remember (docs/feats/creneaux-horaires.md §3):
 *
 *   1. the upper bound is **exclusive** — 6pm belongs to the dinner starting,
 *      not to the snack ending;
 *   2. two moments of the same household never overlap. That is not a code
 *      convention but a database invariant (exclusion constraint, migration
 *      0022): it is what lets `currentMoment` return ONE moment rather than a
 *      list;
 *   3. the day need not be covered. 10:30 belongs to no slot, and that is the
 *      normal case — those gaps are what make some sentences ambiguous, and we
 *      would rather admit it than fill them in by default.
 *
 * Everything here is pure: moments in, a minute integer in. No database, no
 * clock, so it replays in the test suite without freezing time.
 */

import { addISODays, type Now } from "@/lib/clock";

/**
 * The instant, cut down to what this module needs: a day and a minute.
 *
 * Wider than `Now` on purpose — the voice context carries the same two facts
 * without ever having seen a timezone, and should not have to invent one to ask
 * a question about slots.
 */
export type Instant = Pick<Now, "todayISO" | "minutes">;

/**
 * What we need of a moment to place it in the day. Deliberately structural:
 * `MealMoment` (data) and `MomentContext` (voice) both satisfy it without this
 * module having to know either.
 */
export type TimedMoment = {
  id: string;
  label: string;
  startMinute: number;
  endMinute: number;
};

/** Past, current, upcoming — the only question half the product asks. */
export type Phase = "past" | "current" | "future";

export const DAY_MINUTES = 1440;

/** Moments in the order of the day. Clock order IS display order. */
export function sortMoments<T extends TimedMoment>(moments: T[]): T[] {
  return [...moments].sort((a, b) => a.startMinute - b.startMinute);
}

/** The moment whose window contains `minutes`. `null` inside a gap. */
export function currentMoment<T extends TimedMoment>(
  moments: T[],
  minutes: number,
): T | null {
  return (
    moments.find((m) => minutes >= m.startMinute && minutes < m.endMinute) ??
    null
  );
}

/** The last moment already over. `null` before the day's first meal. */
export function lastEndedMoment<T extends TimedMoment>(
  moments: T[],
  minutes: number,
): T | null {
  const ended = sortMoments(moments).filter((m) => m.endMinute <= minutes);
  return ended[ended.length - 1] ?? null;
}

/** The first moment not yet started. `null` after the last meal. */
export function nextMoment<T extends TimedMoment>(
  moments: T[],
  minutes: number,
): T | null {
  return sortMoments(moments).find((m) => m.startMinute > minutes) ?? null;
}

/**
 * The moment **closest to the time it is**: the current one, else the next one
 * coming, else the last one finished.
 *
 * This is the day thread's cursor (`TodayMeals`,
 * docs/feats/creneaux-horaires.md §6.1). The first two rungs say "the meal ahead
 * of you"; the third only serves once evening comes and nothing is ahead — and
 * since everything left is then behind, the last finished one is indeed the
 * closest.
 *
 * The caller decides what goes in: the day thread only passes meals still
 * unanswered, so a meal just closed does not reopen straight away. An empty list
 * has no cursor, and that is a normal state — a fully answered day has no card
 * left to unfold.
 */
export function cursorMoment<T extends TimedMoment>(
  moments: T[],
  minutes: number,
): T | null {
  return (
    currentMoment(moments, minutes) ??
    nextMoment(moments, minutes) ??
    lastEndedMoment(moments, minutes)
  );
}

export function phaseOf(moment: TimedMoment, minutes: number): Phase {
  if (moment.endMinute <= minutes) return "past";
  if (moment.startMinute <= minutes) return "current";
  return "future";
}

// ────────────────────────────────────────────────────────────────────────────
// Day edges
// ────────────────────────────────────────────────────────────────────────────

/** A dated slot: the moment, and the day it falls on. */
export type DatedMoment<T extends TimedMoment = TimedMoment> = {
  dateISO: string;
  moment: T;
};

/**
 * The last finished slot, **spilling back into yesterday**.
 *
 * At 5am, "he had cereal" cannot mean a meal from today: none has started. It
 * means yesterday's dinner. The spillover is one day, once: beyond that it is no
 * longer a deduction, it is an invention.
 */
export function lastEndedSlot<T extends TimedMoment>(
  moments: T[],
  now: Instant,
): DatedMoment<T> | null {
  const today = lastEndedMoment(moments, now.minutes);
  if (today) return { dateISO: now.todayISO, moment: today };

  const ordered = sortMoments(moments);
  const last = ordered[ordered.length - 1];
  return last ? { dateISO: addISODays(now.todayISO, -1), moment: last } : null;
}

/**
 * The next slot, **spilling over into tomorrow**.
 *
 * At 11pm, "he'll have some apple" means tomorrow's breakfast. Same as above:
 * one day, not two.
 */
export function nextSlot<T extends TimedMoment>(
  moments: T[],
  now: Instant,
): DatedMoment<T> | null {
  const today = nextMoment(moments, now.minutes);
  if (today) return { dateISO: now.todayISO, moment: today };

  const first = sortMoments(moments)[0];
  return first ? { dateISO: addISODays(now.todayISO, 1), moment: first } : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Meals
// ────────────────────────────────────────────────────────────────────────────

/** What we need of a meal to place it: its day and its slot. */
type DatedMeal = {
  date: string;
  /** "prevu" = the programme wrote it, the parent said nothing. */
  status: string;
};

/**
 * Is this meal in the past?
 *
 * Two ways to be, and the second is the one that matters:
 *
 *   · **its slot is over** — tonight's dinner is not eaten at 8am, so it must
 *     count neither as an exposure, nor a discovery, nor an allergen
 *     introduction;
 *   · **or the parent has spoken** — a lunch marked served at 12:30 is eaten,
 *     even though its slot runs to 2pm. The app must not forget for ninety
 *     minutes what it has just been told.
 *
 * This function, not a date comparison, is what decides a food is "already
 * eaten" (docs/feats/creneaux-horaires.md §5).
 */
export function isPastMeal(
  meal: DatedMeal,
  moment: TimedMoment | null | undefined,
  now: Instant,
): boolean {
  if (meal.date < now.todayISO) return true;
  if (meal.date > now.todayISO) return false;
  if (meal.status !== "prevu") return true;
  return moment ? moment.endMinute <= now.minutes : false;
}

/**
 * Is this meal still waiting for a signal from the parent?
 *
 * The counterpart of `isPastMeal` for the catch-up strip: a meal whose time has
 * passed, that the programme had filled, and that nobody said anything about. An
 * empty meal does not count — there is nothing to confirm.
 */
export function awaitsSignalAt(
  meal: { date: string; status: string; meal_items: unknown[] },
  moment: TimedMoment | null | undefined,
  now: Instant,
): boolean {
  if (meal.status !== "prevu" || meal.meal_items.length === 0) return false;
  if (meal.date < now.todayISO) return true;
  if (meal.date > now.todayISO) return false;
  return moment ? moment.endMinute <= now.minutes : false;
}

// ────────────────────────────────────────────────────────────────────────────
// Display
// ────────────────────────────────────────────────────────────────────────────

/**
 * "6 h", "11 h 30". French typographic usage: the hour separates, it does not
 * punctuate — no clamped "11h30", no "11:30" that reads like a train timetable.
 */
export function formatMinute(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return minute === 0
    ? `${hour} h`
    : `${hour} h ${String(minute).padStart(2, "0")}`;
}

/** "11 h – 14 h", a moment's window as it is displayed. */
export function windowLabel(moment: TimedMoment): string {
  return `${formatMinute(moment.startMinute)} – ${formatMinute(moment.endMinute)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// Editing (moments manager, behind FEATURE_CUSTOM_MEALS)
// ────────────────────────────────────────────────────────────────────────────

/**
 * What stops a slot from being saved, worded for the parent, or `null`.
 *
 * The database would refuse anyway (the `meal_moments_window` and
 * `meal_moments_no_overlap` constraints): this says so beforehand, and names the
 * clashing moment — which a constraint violation cannot.
 */
export function windowIssue(
  candidate: { startMinute: number; endMinute: number },
  others: TimedMoment[],
): string | null {
  const { startMinute, endMinute } = candidate;
  if (
    !Number.isInteger(startMinute) ||
    !Number.isInteger(endMinute) ||
    startMinute < 0 ||
    endMinute > DAY_MINUTES
  ) {
    return "L'horaire doit tenir dans la journée, entre 0 h et 24 h.";
  }
  if (endMinute <= startMinute) {
    return "La fin doit venir après le début. Un repas ne franchit pas minuit.";
  }
  const clash = others.find(
    (other) => startMinute < other.endMinute && other.startMinute < endMinute,
  );
  if (clash) {
    return `Ce créneau chevauche ${clash.label} (${windowLabel(clash)}).`;
  }
  return null;
}

/**
 * The first gap of at least an hour, so the form suggests a slot instead of an
 * empty field. We start at 8am: that is where a baby's day fills up.
 */
export function firstFreeWindow(
  moments: TimedMoment[],
  durationMinutes = 60,
): { startMinute: number; endMinute: number } | null {
  const ordered = sortMoments(moments);
  const search = (from: number, to: number) => {
    let cursor = from;
    for (const moment of ordered) {
      if (moment.endMinute <= cursor) continue;
      if (moment.startMinute - cursor >= durationMinutes) return cursor;
      cursor = Math.max(cursor, moment.endMinute);
    }
    return to - cursor >= durationMinutes ? cursor : null;
  };

  const start = search(8 * 60, DAY_MINUTES) ?? search(0, 8 * 60);
  return start === null
    ? null
    : { startMinute: start, endMinute: start + durationMinutes };
}
