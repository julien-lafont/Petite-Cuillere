/** Utilitaires de dates (jour local, sans fuseau surprise). */

const MS_PER_DAY = 86_400_000;

/** Date → 'YYYY-MM-DD' en heure locale. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 'YYYY-MM-DD' → Date à minuit **local**. `new Date(iso)` interpréterait la
 * chaîne en UTC et pourrait retomber la veille selon le fuseau.
 */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

/** Lundi de la semaine contenant `d`. */
export function startOfWeek(d: Date): Date {
  const monday = new Date(d);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday;
}

/** Les 7 jours (lundi → dimanche) de la semaine contenant `d`. */
export function weekDays(d: Date): Date[] {
  const monday = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
