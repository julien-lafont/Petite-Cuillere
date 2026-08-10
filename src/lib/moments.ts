/**
 * Les créneaux de repas — LOGIQUE PURE, source unique.
 *
 * Un moment de repas occupe un intervalle `[début, fin[` de la journée locale.
 * Trois règles, et rien d'autre à retenir (docs/feats/creneaux-horaires.md §3) :
 *
 *   1. la borne haute est **exclue** — 18 h 00 appartient au dîner qui commence,
 *      pas au goûter qui finit ;
 *   2. deux moments d'un même foyer ne se chevauchent jamais. Ce n'est pas une
 *      convention de code mais un invariant de la base (contrainte d'exclusion,
 *      migration 0022) : c'est lui qui autorise `currentMoment` à renvoyer UN
 *      moment plutôt qu'une liste ;
 *   3. la journée n'a pas à être couverte. 10 h 30 n'appartient à aucun
 *      créneau, et c'est le cas normal — ce sont ces trous qui rendent certaines
 *      phrases ambiguës, et qu'on préfère avouer plutôt que combler d'office.
 *
 * Tout ici est pur : des moments, un entier de minutes. Aucune base, aucune
 * horloge, donc rejouable dans le jeu de tests sans geler le temps.
 */

import { addISODays, type Now } from "@/lib/clock";

/**
 * L'instant, réduit à ce que ce module en a besoin : un jour et une minute.
 *
 * Plus large que `Now` à dessein — le contexte vocal porte les mêmes deux
 * informations sans jamais avoir vu un fuseau, et n'a pas à en inventer un pour
 * poser une question de créneau.
 */
export type Instant = Pick<Now, "todayISO" | "minutes">;

/**
 * Ce qu'il faut savoir d'un moment pour le situer dans la journée. Volontairement
 * structurel : `MealMoment` (données) et `MomentContext` (vocal) le satisfont
 * tous les deux sans que ce module ait à les connaître.
 */
export type TimedMoment = {
  id: string;
  label: string;
  startMinute: number;
  endMinute: number;
};

/** Passé, en cours, à venir — la seule question que pose la moitié du produit. */
export type Phase = "past" | "current" | "future";

export const DAY_MINUTES = 1440;

/** Les moments dans l'ordre de la journée. L'ordre horaire EST l'ordre d'affichage. */
export function sortMoments<T extends TimedMoment>(moments: T[]): T[] {
  return [...moments].sort((a, b) => a.startMinute - b.startMinute);
}

/** Le moment dont l'intervalle contient `minutes`. `null` dans un trou. */
export function currentMoment<T extends TimedMoment>(
  moments: T[],
  minutes: number,
): T | null {
  return (
    moments.find((m) => minutes >= m.startMinute && minutes < m.endMinute) ??
    null
  );
}

/** Le dernier moment déjà terminé. `null` avant le premier repas de la journée. */
export function lastEndedMoment<T extends TimedMoment>(
  moments: T[],
  minutes: number,
): T | null {
  const ended = sortMoments(moments).filter((m) => m.endMinute <= minutes);
  return ended[ended.length - 1] ?? null;
}

/** Le premier moment pas encore commencé. `null` après le dernier repas. */
export function nextMoment<T extends TimedMoment>(
  moments: T[],
  minutes: number,
): T | null {
  return sortMoments(moments).find((m) => m.startMinute > minutes) ?? null;
}

export function phaseOf(moment: TimedMoment, minutes: number): Phase {
  if (moment.endMinute <= minutes) return "past";
  if (moment.startMinute <= minutes) return "current";
  return "future";
}

// ────────────────────────────────────────────────────────────────────────────
// Les bords de journée
// ────────────────────────────────────────────────────────────────────────────

/** Un créneau daté : le moment, et le jour où il tombe. */
export type DatedMoment<T extends TimedMoment = TimedMoment> = {
  dateISO: string;
  moment: T;
};

/**
 * Le dernier créneau terminé, **en débordant sur la veille**.
 *
 * À 5 h du matin, « il a mangé des céréales » ne peut pas viser un repas
 * d'aujourd'hui : aucun n'a commencé. Il vise le dîner d'hier. Le débordement
 * est d'un jour, une seule fois : au-delà, ce n'est plus une déduction, c'est
 * une invention.
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
 * Le prochain créneau, **en débordant sur le lendemain**.
 *
 * À 23 h, « il mangera de la pomme » vise le petit-déjeuner de demain. Comme
 * ci-dessus : un jour, pas deux.
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
// Les repas
// ────────────────────────────────────────────────────────────────────────────

/** Ce qu'il faut savoir d'un repas pour le situer : son jour et son créneau. */
type DatedMeal = {
  date: string;
  /** « prevu » = le programme l'a écrit, le parent n'a rien dit. */
  status: string;
};

/**
 * Ce repas appartient-il au passé ?
 *
 * Deux façons de l'être, et la seconde est celle qui compte :
 *
 *   · **son créneau est terminé** — le dîner de ce soir n'est pas mangé à 8 h,
 *     et ne doit donc compter ni comme exposition, ni comme découverte, ni
 *     comme introduction d'allergène ;
 *   · **ou le parent s'est prononcé** — un déjeuner marqué « servi » à 12 h 30
 *     est mangé, même si son créneau court jusqu'à 14 h. L'application ne doit
 *     pas oublier pendant une heure et demie ce qu'on vient de lui dire.
 *
 * C'est cette fonction, et non une comparaison de dates, qui décide qu'un
 * aliment est « déjà consommé » (docs/feats/creneaux-horaires.md §5).
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
 * Ce repas attend-il encore un signal du parent ?
 *
 * Le pendant de `isPastMeal` pour la bande de rattrapage : un repas dont l'heure
 * est passée, que le programme avait garni, et dont personne n'a rien dit. Un
 * repas vide n'en est pas un — il n'y a rien à confirmer.
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
// L'affichage
// ────────────────────────────────────────────────────────────────────────────

/**
 * « 6 h », « 11 h 30 ». L'usage typographique français : l'heure sépare, elle ne
 * ponctue pas — pas de « 11h30 » collé, pas de « 11:30 » qui sonne horaire de
 * train.
 */
export function formatMinute(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return minute === 0
    ? `${hour} h`
    : `${hour} h ${String(minute).padStart(2, "0")}`;
}

/** « 11 h – 14 h », le créneau d'un moment tel qu'il s'affiche. */
export function windowLabel(moment: TimedMoment): string {
  return `${formatMinute(moment.startMinute)} – ${formatMinute(moment.endMinute)}`;
}

// ────────────────────────────────────────────────────────────────────────────
// L'édition (gestionnaire de moments, caché derrière FEATURE_CUSTOM_MEALS)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Ce qui empêche d'enregistrer un créneau, dit en français, ou `null`.
 *
 * La base refuserait de toute façon (contraintes `meal_moments_window` et
 * `meal_moments_no_overlap`) : cette fonction sert à le dire avant, et à nommer
 * le moment en conflit — une violation de contrainte ne sait pas faire ça.
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
 * Le premier trou d'au moins une heure, pour proposer un créneau au lieu d'un
 * champ vide. On part de 8 h : c'est là que la journée d'un bébé se remplit.
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
