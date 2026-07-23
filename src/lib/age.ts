/**
 * Calculs d'âge du bébé, y compris l'âge corrigé en cas de prématurité.
 *
 * Règle métier (cf. docs/functional-spec.md) : l'âge corrigé s'applique lorsque la
 * naissance a eu lieu >= 4 semaines avant le terme théorique. On corrige alors l'âge
 * en comptant à partir de la date de terme plutôt que de la date de naissance.
 *
 * Toute la correction d'âge est conditionnée au flag `FEATURE_PREMATURE_BABY_ENABLED` :
 * désactivé, `resolveReferenceDate` et `getAgeInfo` retombent sur l'âge réel, ce qui
 * neutralise la prématurité dans toute l'app (aliments éligibles, programme, libellés).
 */

import { FEATURE_PREMATURE_BABY_ENABLED } from "@/lib/features";

const MS_PER_DAY = 86_400_000;
const PREMATURITY_THRESHOLD_WEEKS = 4;

/** Nombre de semaines de prématurité (terme théorique - naissance). */
export function prematurityWeeks(birthDate: Date, dueDate: Date): number {
  return Math.round((dueDate.getTime() - birthDate.getTime()) / (7 * MS_PER_DAY));
}

/** Vrai si la prématurité justifie l'usage de l'âge corrigé (>= 4 semaines). */
export function isPremature(birthDate: Date, dueDate: Date): boolean {
  return prematurityWeeks(birthDate, dueDate) >= PREMATURITY_THRESHOLD_WEEKS;
}

/** Différence en mois/semaines/jours entre deux dates (from < to). */
export function ageBetween(from: Date, to: Date = new Date()) {
  let months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months--;

  // Date d'ancrage = `from` + `months` mois → on mesure le reliquat en jours/semaines.
  const anchor = new Date(from);
  anchor.setMonth(anchor.getMonth() + months);
  const remainingDays = Math.max(
    0,
    Math.round((to.getTime() - anchor.getTime()) / MS_PER_DAY),
  );
  const weeks = Math.floor(remainingDays / 7);

  return { months, weeks, remainingDays };
}

/** Libellé court et lisible d'un âge, ex. « 6 mois » ou « 6 mois et 2 sem. ». */
export function formatAge(from: Date, to: Date = new Date()): string {
  const { months, weeks } = ageBetween(from, to);
  if (months < 1) {
    const totalWeeks = Math.floor((to.getTime() - from.getTime()) / (7 * MS_PER_DAY));
    return `${totalWeeks} semaine${totalWeeks > 1 ? "s" : ""}`;
  }
  const monthLabel = `${months} mois`;
  return weeks > 0 ? `${monthLabel} et ${weeks} sem.` : monthLabel;
}

/**
 * Date de référence à partir de laquelle l'âge « projeté » est compté.
 * - Fonctionnalité prématurés désactivée → naissance (âge réel), toujours.
 * - Non prématuré → naissance (âge réel).
 * - Prématuré + `ageReferenceDate` défini → cette date (choisie entre naissance
 *   et terme, donc âge entre réel et corrigé).
 * - Prématuré sans date définie → terme (âge corrigé, par défaut).
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
  chronological: string; // âge réel (depuis la naissance)
  corrected: string | null; // âge corrigé, ou null si non prématuré
  isPremature: boolean;
  prematurityWeeks: number;
  /** L'âge « projeté » à utiliser partout (selon la date de référence). */
  effective: string;
  /** Âge projeté en mois complets, pour piloter les seuils (stade de diversification, etc.). */
  effectiveMonths: number;
};

/**
 * Libellé du stade de diversification en fonction de l'âge projeté, cf. seuils
 * de `docs/diversification-guide.md` (démarrage entre 4 et 6 mois révolus).
 */
export function diversificationStage(effectiveMonths: number): string {
  if (effectiveMonths < 4) return "avant la diversification";
  if (effectiveMonths < 6) return "début de la diversification";
  if (effectiveMonths < 12) return "en pleine diversification";
  if (effectiveMonths < 24) return "vers les repas familiaux";
  return "alimentation familiale";
}

/**
 * Synthèse d'âge à partir des dates de naissance et de terme théorique.
 * `dueDate` peut être null (terme non renseigné) → pas de correction.
 * Flag prématurés désactivé → tout est ramené à l'âge réel (`corrected` à null,
 * `isPremature` à false), quelles que soient les dates fournies.
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
  const referenceDate = resolveReferenceDate(birthDate, dueDate, ageReferenceDate);
  const chronological = formatAge(birthDate, today);
  const corrected = premature && dueDate ? formatAge(dueDate, today) : null;
  const effective = formatAge(referenceDate, today);
  return {
    chronological,
    corrected,
    isPremature: premature,
    prematurityWeeks: premature && dueDate ? prematurityWeeks(birthDate, dueDate) : 0,
    effective,
    effectiveMonths: ageBetween(referenceDate, today).months,
  };
}
