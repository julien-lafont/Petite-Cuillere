/**
 * Household time — the product's only source of "now".
 *
 * `new Date()` is not one on the server: in production that is Vercel's clock,
 * so UTC, and between midnight and 2am the app still thinks it is yesterday.
 * Meal time slots make that blocking (docs/feats/creneaux-horaires.md §1).
 *
 * The timezone belongs to the **household**, not the device: meals happen at the
 * child's home, and a helper who is travelling must see the baby's day, not
 * their own. It is stored on `households.timezone` (migration 0022).
 *
 * This module is pure: it reads nothing, it is given the timezone and, for
 * tests, the instant.
 */

export const DEFAULT_TIME_ZONE = "Europe/Paris";

/**
 * The current instant, as the household sees it.
 *
 * `minutes` counts minutes since local midnight — 16:30 is 990. An integer
 * rather than a `Date`: it is what everything else compares, and it tests
 * without freezing the clock.
 */
export type Now = {
  /** The household's local day, "YYYY-MM-DD". */
  todayISO: string;
  /** Minutes since local midnight, 0 → 1439. */
  minutes: number;
  timeZone: string;
};

/**
 * Formatters are expensive to build (~1 ms) and perfectly reusable. One
 * household, one formatter, for the life of the process.
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
    // `h23`, not `h12` nor the default: midnight must read 00 and not 24, or
    // the first minute of the day would come out as 1440.
    hourCycle: "h23",
  });
  FORMATTERS.set(timeZone, formatter);
  return formatter;
}

/**
 * A timezone the runtime does not know must not take a page down: the value
 * comes from browser detection, so it is not entirely ours to control. Fall back
 * to Paris and say so once.
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

/** The household's day and minute at instant `at`. */
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
 * Shifts an ISO day using calendar arithmetic.
 *
 * `addDays` (lib/dates) adds 24 hours to a local `Date`: the day the clocks go
 * back has 25, and the result lands on the day before. Here there is no hour and
 * no timezone, so nothing can drift.
 */
export function addISODays(dateISO: string, days: number): string {
  const [year, month, day] = dateISO.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** Days from `fromISO` to `toISO` (negative if `toISO` is earlier). */
export function diffISODays(fromISO: string, toISO: string): number {
  const at = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((at(toISO) - at(fromISO)) / 86_400_000);
}
