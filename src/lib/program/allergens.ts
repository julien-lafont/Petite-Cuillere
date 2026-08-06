/**
 * La piste allergènes — LOGIQUE PURE, indépendante de la piste découverte.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * POURQUOI UNE PISTE À PART
 *
 * Le générateur faisait de l'allergène la « nouveauté du jour », prioritaire
 * sur tout le reste. Une découverte sur deux était donc un allergène, à l'âge
 * précis où l'acceptation des légumes se construit.
 *
 * Or une cuillère de purée de sésame délayée dans une compote déjà connue
 * n'est pas une découverte gustative : c'est un ajout. La piste allergènes a
 * donc son propre calendrier et n'entame le rythme des découvertes que quand
 * son support est lui-même un vrai aliment (œuf, poisson, laitage, kiwi).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE PROTOCOLE
 *
 * Trois doses, d'après les analyses conjointes de LEAP et EAT, reprises en
 * France (Revue du Praticien) : « 1 petite cuillère à café 4 fois par semaine,
 * ce qui correspond à 2 g de protéine d'arachide par semaine ».
 *
 *   J1  test      — une pointe de cuillère, le matin ou le midi, jamais le soir
 *   J2  montée    — la dose cible
 *   puis entretien — ~2 g de protéine par semaine, en 2 prises
 *
 * L'entretien est ce qui manquait le plus : un allergène introduit puis
 * abandonné ne protège pas. Beaucoup s'auto-entretiennent une fois qu'ils sont
 * des aliments quotidiens (lait, blé, œuf, poisson) ; les autres — arachide,
 * fruits à coque, sésame — sont regroupés en une cuillère d'oléagineux servie
 * au goûter, en rotation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LA CIBLE
 *
 * Tous les allergènes introduits dans leur fenêtre, sans exception. Le
 * calendrier est donc construit **à rebours** de l'échéance de chacun
 * (`min(fin de fenêtre, 12 mois)`), avec un pas qui se resserre si le temps
 * manque — mais jamais en dessous de deux jours, sans quoi une réaction ne
 * serait plus imputable au bon aliment. Sous ce seuil, le programme cesse de
 * comprimer et le signale au parent (`PlanNotice`).
 */

import { DAYS_PER_MONTH } from "@/lib/program/schedule";

/** Échéance absolue : au-delà, la fenêtre d'induction de tolérance est passée. */
export const HARD_DEADLINE_MONTHS = 12;

/** Pas nominal entre deux introductions — délai d'apparition d'une réaction retardée. */
export const NOMINAL_GAP_DAYS = 3;

/**
 * Ancienneté minimale avant le premier allergène. La fenêtre 4-6 mois est
 * précieuse, mais un enfant qui a goûté deux légumes en trois jours n'est pas
 * prêt : on lui laisse une petite semaine d'alimentation solide d'abord.
 */
export const START_AFTER_TENURE_DAYS = 5;

/** Pas minimal : en deçà, une réaction ne serait plus imputable. */
export const MIN_GAP_DAYS = 2;

/** Nombre maximal d'expositions d'entretien ajoutées à une même journée. */
export const MAX_MAINTENANCE_PER_DAY = 2;

export type AllergenSpec = {
  id: string;
  name: string;
  /** Famille : « protéine », « oléagineux », « condiment »… Oriente le support. */
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

/** Motif pour lequel un allergène ne sera pas planifié. */
export type PlanNotice = {
  kind: "medical-advice" | "reaction" | "window-too-tight" | "no-vector";
  allergenName: string;
  message: string;
};

/** Échéance d'un allergène, en mois d'âge. */
export function deadlineMonths(a: AllergenSpec): number {
  return Math.min(
    a.window_end_months ?? HARD_DEADLINE_MONTHS,
    HARD_DEADLINE_MONTHS,
  );
}

/** Un allergène est planifiable s'il porte une fenêtre chiffrée. */
export function isSchedulable(a: AllergenSpec): boolean {
  return a.window_start_months !== null && a.intro_order !== null;
}

/**
 * Pas à appliquer aujourd'hui, calculé à rebours : on regarde combien de jours
 * restent avant l'échéance la plus proche parmi les allergènes en attente, et
 * combien il en reste à placer.
 */
export function adaptiveGapDays(
  pending: AllergenSpec[],
  ageMonths: number,
): number {
  if (pending.length === 0) return NOMINAL_GAP_DAYS;
  const earliest = Math.min(...pending.map(deadlineMonths));
  const daysLeft = (earliest - ageMonths) * DAYS_PER_MONTH;
  // Combien doivent tenir avant cette échéance-là.
  const dueBefore = pending.filter(
    (a) => deadlineMonths(a) <= earliest + 0.01,
  ).length;
  const needed = daysLeft / Math.max(1, dueBefore);
  if (!isFinite(needed)) return NOMINAL_GAP_DAYS;
  return Math.max(MIN_GAP_DAYS, Math.min(NOMINAL_GAP_DAYS, Math.floor(needed)));
}

/**
 * Vrai si la fenêtre est trop serrée pour placer ce qui reste sans descendre
 * sous le pas minimal — auquel cas on prévient plutôt que de comprimer.
 */
export function windowTooTight(
  pending: AllergenSpec[],
  ageMonths: number,
): boolean {
  if (pending.length === 0) return false;
  const daysLeft = (HARD_DEADLINE_MONTHS - ageMonths) * DAYS_PER_MONTH;
  return daysLeft < pending.length * MIN_GAP_DAYS;
}

/** Intervalle en jours entre deux expositions d'entretien. */
export function maintenanceIntervalDays(a: AllergenSpec): number | null {
  if (a.maintenance_per_week <= 0) return null;
  return Math.ceil(7 / a.maintenance_per_week);
}

/** Libellé de dose selon la phase. */
export function doseFor(a: AllergenSpec, phase: AllergenPhase): string | null {
  if (phase === "test") return a.starting_dose;
  return a.target_dose;
}

/**
 * Ordre de passage : l'ordre du catalogue, qui classe par force de la preuve
 * puis par fréquence chez l'enfant en France. Les allergènes à essai
 * randomisé (arachide, œuf, lait) passent en tête, et leur fenêtre 4-6 mois
 * est la plus étroite — les deux critères vont dans le même sens.
 */
export function byIntroOrder(a: AllergenSpec, b: AllergenSpec): number {
  return (
    (a.intro_order ?? 999) - (b.intro_order ?? 999) ||
    a.name.localeCompare(b.name, "fr")
  );
}
