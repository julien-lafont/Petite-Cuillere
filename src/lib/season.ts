/**
 * Seasonality of fruit and vegetables in France.
 * A season is a list of inclusive month ranges, e.g. [[6,8],[1,3]] = June→August
 * and January→March. `null` = no season at all (meat, eggs…).
 */
export type Season = number[][] | null;

const MONTHS_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

/** Normalises a month number into 1..12, wrapping around. */
const norm = (x: number) => ((((x - 1) % 12) + 12) % 12) + 1;

/** Is `month` inside the circular interval start..end (inclusive)? */
function within(month: number, start: number, end: number): boolean {
  return start <= end
    ? month >= start && month <= end
    : month >= start || month <= end;
}

/**
 * Is `month` one of the season's months?
 *
 * No margin around the range: the verdict is printed next to the very months it
 * is read from — « De saison · sept.–déc. » — so widening it by even one month
 * puts a contradiction on screen, and tells the shopping list to buy out of
 * season produce fresh.
 */
export function inSeason(season: Season, month: number): boolean {
  if (!season || season.length === 0) return false;
  return season.some(([s, e]) => within(month, s, e));
}

export type FreshnessAdvice = "frais" | "surgele" | null;

/**
 * Buying advice: fresh in season, frozen out of it. `null` when the food has
 * no season at all — meat, eggs.
 */
export function freshnessAdvice(
  season: Season,
  month: number,
): FreshnessAdvice {
  if (!season || season.length === 0) return null;
  return inSeason(season, month) ? "frais" : "surgele";
}

/** Months (1..12) a season covers, flattened, for a checkbox editor. */
export function seasonToMonths(season: Season): number[] {
  if (!season) return [];
  const months = new Set<number>();
  for (const [s, e] of season) {
    let m = s;
    while (true) {
      months.add(m);
      if (m === e) break;
      m = norm(m + 1);
    }
  }
  return [...months].sort((a, b) => a - b);
}

/** Groups a month selection (1..12) into consecutive ranges, or `null` if empty. */
export function monthsToSeason(months: number[]): Season {
  if (months.length === 0) return null;
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  const ranges: number[][] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (const m of sorted.slice(1)) {
    if (m === prev + 1) {
      prev = m;
      continue;
    }
    ranges.push([start, prev]);
    start = m;
    prev = m;
  }
  ranges.push([start, prev]);
  return ranges;
}

/** Readable label for a season, e.g. "juin–août, janv.–mars". */
export function formatSeason(season: Season): string {
  if (!season || season.length === 0) return "";
  return season
    .map(([s, e]) =>
      s === e
        ? MONTHS_SHORT[s - 1]
        : `${MONTHS_SHORT[s - 1]}–${MONTHS_SHORT[e - 1]}`,
    )
    .join(", ");
}
