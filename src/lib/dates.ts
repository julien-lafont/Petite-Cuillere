/**
 * Date helpers for the local day, with no timezone surprises.
 *
 * "Local" here means the process's, which is fine in the browser and wrong on
 * the server — production runs in UTC. To place a **household** day or hour, use
 * `lib/clock.ts`, and `addISODays` rather than `addDays`: the latter adds 24
 * hours to a `Date`, and the day the clocks go back has 25.
 */

const MS_PER_DAY = 86_400_000;

/** Date → 'YYYY-MM-DD' in local time. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 'YYYY-MM-DD' → Date at **local** midnight. `new Date(iso)` would read the
 * string as UTC and could land a day early depending on the timezone.
 */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

/** Monday of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday;
}

/** The 7 days (Monday → Sunday) of the week containing `d`. */
export function weekDays(d: Date): Date[] {
  const monday = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
