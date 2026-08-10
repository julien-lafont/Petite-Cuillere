/**
 * L'heure du foyer — la seule source de « maintenant » du produit.
 *
 * `new Date()` n'en est pas une côté serveur : en production c'est l'horloge de
 * Vercel, donc UTC, et entre minuit et 2 h l'application se croit encore la
 * veille. Le bug était invisible tant que rien ne dépendait de l'heure ; les
 * créneaux de repas le rendent bloquant (docs/feats/creneaux-horaires.md §1).
 *
 * Le fuseau appartient au **foyer**, pas à l'appareil : les repas ont lieu chez
 * l'enfant, et un aidant en déplacement doit voir la journée du bébé, pas la
 * sienne. Il est stocké sur `households.timezone` (migration 0022).
 *
 * Ce module est pur : il ne lit rien, on lui donne le fuseau et, pour les tests,
 * l'instant.
 */

export const DEFAULT_TIME_ZONE = "Europe/Paris";

/**
 * L'instant courant, vu du foyer.
 *
 * `minutes` compte les minutes écoulées depuis minuit local — 16 h 30 vaut 990.
 * Un entier plutôt qu'une `Date` : c'est ce que tout le reste compare, et il se
 * teste sans geler l'horloge.
 */
export type Now = {
  /** Jour local du foyer, « YYYY-MM-DD ». */
  todayISO: string;
  /** Minutes depuis minuit local, 0 → 1439. */
  minutes: number;
  timeZone: string;
};

/**
 * Les formateurs sont chers à construire (~1 ms) et parfaitement réutilisables.
 * Un foyer, un formateur, pour toute la vie du processus.
 */
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = FORMATTERS.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    // `h23` et non `h12` ni le défaut : minuit doit valoir 00 et non 24, sans
    // quoi la première minute de la journée sortirait à 1440.
    hourCycle: "h23",
  });
  FORMATTERS.set(timeZone, formatter);
  return formatter;
}

/**
 * Un fuseau que l'environnement ne connaît pas ne doit pas faire tomber une
 * page : la valeur vient d'une détection navigateur, donc d'une donnée qu'on ne
 * maîtrise pas entièrement. On retombe sur Paris et on le dit une fois.
 */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  try {
    partsFormatter(timeZone);
    return timeZone;
  } catch {
    console.warn(`clock: fuseau inconnu « ${timeZone} », repli sur Paris.`);
    return DEFAULT_TIME_ZONE;
  }
}

/** Le jour et la minute du foyer, à l'instant `at`. */
export function nowIn(timeZone: string, at: Date = new Date()): Now {
  const zone = safeTimeZone(timeZone);
  const parts = partsFormatter(zone).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return {
    todayISO: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    timeZone: zone,
  };
}

/**
 * Décale un jour ISO, en arithmétique de calendrier.
 *
 * `addDays` (lib/dates) ajoute 24 heures à une `Date` locale : le jour du
 * passage à l'heure d'hiver en compte 25, et le résultat retombe la veille.
 * Ici il n'y a ni heure ni fuseau, donc rien à décaler de travers.
 */
export function addISODays(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** Nombre de jours de `fromISO` à `toISO` (négatif si `toISO` est antérieur). */
export function diffISODays(fromISO: string, toISO: string): number {
  const at = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((at(toISO) - at(fromISO)) / 86_400_000);
}
