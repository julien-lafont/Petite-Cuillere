/**
 * The allergen track — PURE LOGIC, independent of the discovery track.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * WHY A SEPARATE TRACK
 *
 * The generator used to make the allergen the "discovery of the day", ahead of
 * everything else. One discovery in two was therefore an allergen, at exactly
 * the age where acceptance of vegetables is built.
 *
 * But a spoon of sesame paste stirred into a familiar compote is not a taste
 * discovery: it is an addition. So the allergen track has its own calendar, and
 * only eats into the discovery rhythm when its carrier is itself a real food
 * (egg, fish, dairy, kiwi).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE PROTOCOL
 *
 * Three doses, from the joint LEAP and EAT analyses, taken up in France (Revue
 * du Praticien): "1 small teaspoon 4 times a week, which is 2 g of peanut
 * protein a week".
 *
 *   D1  test        — a knife tip, morning or midday, never in the evening
 *   D2  ramp-up     — the target dose
 *   then maintenance — ~2 g of protein a week, over 2 servings
 *
 * Maintenance was the biggest gap: an allergen introduced then dropped does not
 * protect. Many maintain themselves once they are everyday foods (milk, wheat,
 * egg, fish); the others — peanut, tree nuts, sesame — are gathered into one
 * spoon of nut butter served at snack time, in rotation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE TARGET
 *
 * Every allergen introduced inside its window, no exceptions. The calendar is
 * therefore built **backwards** from each one's deadline (`min(end of window, 12
 * months)`), with a gap that tightens when time runs short — but never below two
 * days, or a reaction could no longer be pinned on the right food. Below that
 * threshold the programme stops compressing and tells the parent (`PlanNotice`).
 */

import { DAYS_PER_MONTH } from "@/lib/program/schedule";

/** Absolute deadline: past it, the tolerance-induction window has closed. */
export const HARD_DEADLINE_MONTHS = 12;

/** Nominal gap between two introductions — the time a delayed reaction takes to show. */
export const NOMINAL_GAP_DAYS = 3;

/**
 * Minimum elapsed time before the first allergen. The 4-6 month window is
 * precious, but a child who has tasted two vegetables in three days is not
 * ready: we give them a short week of solid food first.
 */
export const START_AFTER_TENURE_DAYS = 5;

/** Minimum gap: below it, a reaction could no longer be attributed. */
export const MIN_GAP_DAYS = 2;

/** Most maintenance exposures added to a single day. */
export const MAX_MAINTENANCE_PER_DAY = 2;

export type AllergenSpec = {
  id: string;
  name: string;
  /** Family: "protéine", "oléagineux", "condiment"… Steers the carrier. */
  type: string | null;
  intro_order: number | null;
  window_start_months: number | null;
  window_end_months: number | null;
  evidence_level: string | null;
  starting_dose: string | null;
  target_dose: string | null;
  maintenance_per_week: number;
  requires_medical_advice: boolean;
};

export type AllergenPhase = "test" | "montée" | "entretien";

/** Why an allergen will not be planned. */
export type PlanNotice = {
  kind: "medical-advice" | "reaction" | "window-too-tight" | "no-vector";
  allergenName: string;
  message: string;
};

/** An allergen's deadline, in months of age. */
export function deadlineMonths(a: AllergenSpec): number {
  return Math.min(
    a.window_end_months ?? HARD_DEADLINE_MONTHS,
    HARD_DEADLINE_MONTHS,
  );
}

/** An allergen is plannable when it carries a numeric window. */
export function isSchedulable(a: AllergenSpec): boolean {
  return a.window_start_months !== null && a.intro_order !== null;
}

/**
 * The gap to apply today, computed backwards: how many days remain before the
 * nearest deadline among the pending allergens, and how many are left to place.
 */
export function adaptiveGapDays(
  pending: AllergenSpec[],
  ageMonths: number,
): number {
  if (pending.length === 0) return NOMINAL_GAP_DAYS;
  const earliest = Math.min(...pending.map(deadlineMonths));
  const daysLeft = (earliest - ageMonths) * DAYS_PER_MONTH;
  // How many have to fit before that deadline.
  const dueBefore = pending.filter(
    (a) => deadlineMonths(a) <= earliest + 0.01,
  ).length;
  const needed = daysLeft / Math.max(1, dueBefore);
  if (!isFinite(needed)) return NOMINAL_GAP_DAYS;
  return Math.max(MIN_GAP_DAYS, Math.min(NOMINAL_GAP_DAYS, Math.floor(needed)));
}

/**
 * True when the window is too tight to fit what is left without going below the
 * minimum gap — in which case we warn rather than compress.
 */
export function windowTooTight(
  pending: AllergenSpec[],
  ageMonths: number,
): boolean {
  if (pending.length === 0) return false;
  const daysLeft = (HARD_DEADLINE_MONTHS - ageMonths) * DAYS_PER_MONTH;
  return daysLeft < pending.length * MIN_GAP_DAYS;
}

/** Days between two maintenance exposures. */
export function maintenanceIntervalDays(a: AllergenSpec): number | null {
  if (a.maintenance_per_week <= 0) return null;
  return Math.ceil(7 / a.maintenance_per_week);
}

/** Dose label for each phase. */
export function doseFor(a: AllergenSpec, phase: AllergenPhase): string | null {
  if (phase === "test") return a.starting_dose;
  return a.target_dose;
}

/**
 * Running order: the catalogue's, which sorts by strength of evidence then by
 * how common the allergy is in French children. The randomised-trial allergens
 * (peanut, egg, milk) come first, and their 4-6 month window is the narrowest —
 * both criteria pull the same way.
 */
export function byIntroOrder(a: AllergenSpec, b: AllergenSpec): number {
  return (
    (a.intro_order ?? 999) - (b.intro_order ?? 999) ||
    a.name.localeCompare(b.name, "fr")
  );
}
