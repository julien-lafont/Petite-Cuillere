/**
 * Saisonnalité des fruits/légumes en France.
 * Une saison = liste d'intervalles de mois inclusifs, ex. [[6,8],[1,3]] = juin→août
 * et janvier→mars. `null` = pas de saison (produit non saisonnier : viande, œuf…).
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

/** Normalise un numéro de mois dans 1..12 (gère les débordements). */
const norm = (x: number) => (((x - 1) % 12) + 12) % 12 + 1;

/** `month` est-il dans l'intervalle circulaire start..end (inclusif) ? */
function within(month: number, start: number, end: number): boolean {
  return start <= end
    ? month >= start && month <= end
    : month >= start || month <= end;
}

/** Vrai si `month` tombe dans la saison, avec une tolérance (en mois). */
export function inSeason(season: Season, month: number, tolerance = 1): boolean {
  if (!season || season.length === 0) return false;
  return season.some(([s, e]) =>
    within(month, norm(s - tolerance), norm(e + tolerance)),
  );
}

export type FreshnessAdvice = "frais" | "surgele" | null;

/**
 * Conseil d'achat : frais si on est à ±1 mois de la saison, surgelé sinon.
 * `null` si l'aliment n'a pas de saison.
 */
export function freshnessAdvice(season: Season, month: number): FreshnessAdvice {
  if (!season || season.length === 0) return null;
  return inSeason(season, month, 1) ? "frais" : "surgele";
}

/** Mois (1..12) couverts par une saison, à plat (pour un éditeur à cases à cocher). */
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

/** Regroupe une sélection de mois (1..12) en intervalles consécutifs, ou `null` si vide. */
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

/** Libellé lisible d'une saison, ex. « juin–août, janv.–mars ». */
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
