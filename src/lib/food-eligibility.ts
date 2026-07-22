/** Éligibilité des aliments à l'âge du bébé — pur, utilisable côté client comme serveur. */

import type { FoodRow } from "@/lib/data/foods";
import { resolveReferenceDate, ageBetween } from "@/lib/age";

/** Âge du bébé (en mois) à une date donnée, selon la date de référence (corrigée ou non). */
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
 * Âge projeté du bébé (en mois, décimales possibles) à une date donnée. Utilisé pour
 * comparer aux seuils fractionnaires d'ouverture des créneaux (ex. 5,5 mois), à l'image
 * du générateur de programme (`buildPlan`).
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

/** Vrai si au moins un aliment du catalogue est éligible à cet âge. */
export function hasEligibleFoods(foods: FoodRow[], ageMonths: number): boolean {
  return foods.some((f) => (f.age_introduction_min ?? 0) <= ageMonths);
}
