/** Food eligibility for the baby's age — pure, usable on client and server. */

import type { FoodRow } from "@/lib/data/foods";
import { resolveReferenceDate, ageBetween } from "@/lib/age";

/** Baby's age in months on a given date, from the reference date (corrected or not). */
export function ageMonthsAtDate(
  dateISO: string,
  birthDate: string,
  dueDate: string | null,
  ageReferenceDate: string | null,
): number {
  return ageBetween(
    resolveReferenceDate(
      new Date(birthDate),
      dueDate ? new Date(dueDate) : null,
      ageReferenceDate ? new Date(ageReferenceDate) : null,
    ),
    new Date(`${dateISO}T00:00:00`),
  ).months;
}

const DAYS_PER_MONTH = 30.4375;

/**
 * Projected age of the baby in months, decimals included, on a given date. Used
 * against the fractional thresholds that open slots (5.5 months, say), the same
 * way the programme generator (`buildPlan`) does.
 */
export function ageMonthsDecimalAtDate(
  dateISO: string,
  birthDate: string,
  dueDate: string | null,
  ageReferenceDate: string | null,
): number {
  const ref = resolveReferenceDate(
    new Date(birthDate),
    dueDate ? new Date(dueDate) : null,
    ageReferenceDate ? new Date(ageReferenceDate) : null,
  );
  const day = new Date(`${dateISO}T00:00:00`);
  return (day.getTime() - ref.getTime()) / (86_400_000 * DAYS_PER_MONTH);
}

/** True when at least one catalogue food is eligible at this age. */
export function hasEligibleFoods(foods: FoodRow[], ageMonths: number): boolean {
  return foods.some((f) => (f.age_introduction_min ?? 0) <= ageMonths);
}
