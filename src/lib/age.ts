/**
 * Baby age maths, including the corrected age for premature births.
 *
 * Business rule (see docs/functional-spec.md): the corrected age applies when
 * birth happened >= 4 weeks before the due date. The age is then counted from
 * the due date rather than the birth date.
 *
 * All age correction hangs off the `FEATURE_PREMATURE_BABY_ENABLED` flag: with
 * it off, `resolveReferenceDate` and `getAgeInfo` fall back to the real age,
 * which neutralises prematurity across the app — eligible foods, programme,
 * labels.
 */

import { FEATURE_PREMATURE_BABY_ENABLED } from "@/lib/features";

const MS_PER_DAY = 86_400_000;
const PREMATURITY_THRESHOLD_WEEKS = 4;

/** Weeks of prematurity (due date - birth). */
export function prematurityWeeks(birthDate: Date, dueDate: Date): number {
  return Math.round(
    (dueDate.getTime() - birthDate.getTime()) / (7 * MS_PER_DAY),
  );
}

/** True when prematurity warrants the corrected age (>= 4 weeks). */
export function isPremature(birthDate: Date, dueDate: Date): boolean {
  return prematurityWeeks(birthDate, dueDate) >= PREMATURITY_THRESHOLD_WEEKS;
}

/** Difference in months/weeks/days between two dates (from < to). */
export function ageBetween(from: Date, to: Date = new Date()) {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months--;

  // Anchor = `from` + `months` months → the rest is measured in days and weeks.
  const anchor = new Date(from);
  anchor.setMonth(anchor.getMonth() + months);
  const remainingDays = Math.max(
    0,
    Math.round((to.getTime() - anchor.getTime()) / MS_PER_DAY),
  );
  const weeks = Math.floor(remainingDays / 7);

  return { months, weeks, remainingDays };
}

/** Short readable age label, e.g. "6 mois" or "6 mois et 2 sem.". */
export function formatAge(from: Date, to: Date = new Date()): string {
  const { months, weeks } = ageBetween(from, to);
  if (months < 1) {
    const totalWeeks = Math.floor(
      (to.getTime() - from.getTime()) / (7 * MS_PER_DAY),
    );
    return `${totalWeeks} semaine${totalWeeks > 1 ? "s" : ""}`;
  }
  const monthLabel = `${months} mois`;
  return weeks > 0 ? `${monthLabel} et ${weeks} sem.` : monthLabel;
}

/**
 * The reference date the "projected" age is counted from.
 * - Premature feature off → birth (real age), always.
 * - Not premature → birth (real age).
 * - Premature with an `ageReferenceDate` → that date, chosen between birth and
 *   due date, so an age between real and corrected.
 * - Premature without one → due date (corrected age, the default).
 */
export function resolveReferenceDate(
  birthDate: Date,
  dueDate: Date | null,
  ageReferenceDate: Date | null,
): Date {
  if (!FEATURE_PREMATURE_BABY_ENABLED) return birthDate;
  const premature = dueDate ? isPremature(birthDate, dueDate) : false;
  if (!premature) return birthDate;
  return ageReferenceDate ?? dueDate!;
}

export type AgeInfo = {
  chronological: string; // real age, since birth
  corrected: string | null; // corrected age, or null when not premature
  isPremature: boolean;
  prematurityWeeks: number;
  /** The projected age to use everywhere, from the reference date. */
  effective: string;
  /** Projected age in whole months, to drive thresholds (diversification stage, etc.). */
  effectiveMonths: number;
};

/**
 * Diversification stage label for a projected age, using the thresholds in
 * `docs/diversification-guide.md` (start between 4 and 6 completed months).
 */
export function diversificationStage(effectiveMonths: number): string {
  if (effectiveMonths < 4) return "avant la diversification";
  if (effectiveMonths < 6) return "début de la diversification";
  if (effectiveMonths < 12) return "en pleine diversification";
  if (effectiveMonths < 24) return "vers les repas familiaux";
  return "alimentation familiale";
}

/**
 * Age summary from the birth and due dates. `dueDate` may be null (no due date
 * recorded) → no correction. With the premature flag off everything falls back
 * to the real age (`corrected` null, `isPremature` false), whatever the dates.
 */
export function getAgeInfo(
  birthDate: Date,
  dueDate: Date | null,
  ageReferenceDate: Date | null = null,
  today: Date = new Date(),
): AgeInfo {
  const premature =
    FEATURE_PREMATURE_BABY_ENABLED && dueDate
      ? isPremature(birthDate, dueDate)
      : false;
  const referenceDate = resolveReferenceDate(
    birthDate,
    dueDate,
    ageReferenceDate,
  );
  const chronological = formatAge(birthDate, today);
  const corrected = premature && dueDate ? formatAge(dueDate, today) : null;
  const effective = formatAge(referenceDate, today);
  return {
    chronological,
    corrected,
    isPremature: premature,
    prematurityWeeks:
      premature && dueDate ? prematurityWeeks(birthDate, dueDate) : 0,
    effective,
    effectiveMonths: ageBetween(referenceDate, today).months,
  };
}

/* ----------------------------------------------- the product's upper bound --- */

/**
 * The product supports diversification, which ends at the **first birthday** (a
 * scoping decision, see docs/ux-redesign.md). Past it the child gradually joins
 * the family's meals: the guidelines the generator follows — introduction order,
 * textures, allergen windows — no longer apply.
 */
export const ACCOMPANIMENT_END_MONTHS = 12;

/** Below this bound the programme will be very short: warn the parent. */
export const ACCOMPANIMENT_ENDING_SOON_MONTHS = 11;

export type AgeEligibility =
  /** Support is fully worthwhile. */
  | "ok"
  /** Usable, but less than a month is left before the birthday. */
  | "ending-soon"
  /** Out of scope: the child is already past their first birthday. */
  | "too-old";

export function ageEligibility(
  birthDate: Date,
  today: Date = new Date(),
): AgeEligibility {
  const { months } = ageBetween(birthDate, today);
  if (months >= ACCOMPANIMENT_END_MONTHS) return "too-old";
  if (months >= ACCOMPANIMENT_ENDING_SOON_MONTHS) return "ending-soon";
  return "ok";
}

/**
 * Does the programme already reach the first birthday? Compared on ISO
 * 'YYYY-MM-DD' strings (lexicographic order = chronological order) to stay
 * timezone-proof. As everywhere in this section the bound is the real age: a
 * first birthday is not corrected.
 */
export function programCoversFirstYear(
  lastPlannedDateISO: string | null,
  birthDateISO: string,
): boolean {
  if (!lastPlannedDateISO) return false;
  const [year, rest] = [birthDateISO.slice(0, 4), birthDateISO.slice(4)];
  return lastPlannedDateISO >= `${Number(year) + 1}${rest}`;
}

/** Days left before the first birthday (0 once it has passed). */
export function daysUntilFirstBirthday(
  birthDate: Date,
  today: Date = new Date(),
): number {
  const first = new Date(birthDate);
  first.setFullYear(first.getFullYear() + 1);
  return Math.max(
    0,
    Math.ceil((first.getTime() - today.getTime()) / MS_PER_DAY),
  );
}

/**
 * Ceiling on how many days a programme may cover. A newborn born today needs
 * 381: the margin absorbs rounding, not a use case.
 *
 * A guard rather than a business rule — a birth date in the future yields
 * negative months, hence a programme spanning centuries, and every day is a loop
 * that allocates meals.
 */
export const MAX_PROGRAM_DAYS = 400;

/**
 * How many days of programme to generate from `fromISO` to cover diversification
 * up to the first birthday (the product's bound, see docs/ux-redesign.md D4). We
 * go to roughly 12.5 months of age, with a floor of 30 days for children already
 * past it.
 *
 * Used for both initial generation and replanning: both must aim at exactly the
 * same end, or replanning would silently shorten or stretch the programme.
 *
 * The cap is applied here rather than at the call site: `replanFrom` fires on a
 * skipped meal or a confirmed dictation, and has no reason to know about
 * `generateProgram`'s guard.
 */
export function programDaysFrom(
  birthISO: string,
  fromISO: string = toISODateLocal(new Date()),
): number {
  const months = ageBetween(
    new Date(birthISO),
    new Date(`${fromISO}T00:00:00`),
  ).months;
  const remainingMonths = Math.max(0, 12.5 - months);
  return Math.min(
    MAX_PROGRAM_DAYS,
    Math.max(30, Math.round(remainingMonths * 30.44)),
  );
}

/** Local date as a short ISO string, without importing `lib/dates` (import cycle). */
function toISODateLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
