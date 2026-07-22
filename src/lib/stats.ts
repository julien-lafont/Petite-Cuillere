/**
 * Agrégations pures pour la page Statistiques — aucune dépendance réseau/DB,
 * testables isolément. Toutes les fonctions opèrent sur des repas déjà chargés
 * (passés/du jour uniquement — jamais de repas futurs, qui n'ont pas de sens ici).
 */

import { addDays, startOfWeek, toISODate } from "@/lib/dates";
import { CATEGORY_ORDER, type FoodCategory } from "@/lib/categories";
import type { MealWithDetails, MealResult } from "@/lib/data/meals.types";

export type StatsPeriod = "7" | "30" | "90" | "all";

export const STATS_PERIODS: { value: StatsPeriod; label: string }[] = [
  { value: "7", label: "7 j" },
  { value: "30", label: "30 j" },
  { value: "90", label: "90 j" },
  { value: "all", label: "Tout" },
];

/** Première date (incluse) de la période sélectionnée. */
export function periodStartISO(
  period: StatsPeriod,
  todayISO: string,
  babyBirthISO: string,
): string {
  if (period === "all") return babyBirthISO;
  const days = Number(period);
  return toISODate(addDays(new Date(`${todayISO}T00:00:00`), -(days - 1)));
}

/** Score numérique (0-100) d'un résultat de repas, `null` si non évalué. */
export function mealScore(result: MealResult): number | null {
  if (result === "bien") return 100;
  if (result === "moyen") return 50;
  if (result === "refuse") return 0;
  return null;
}

/** Date de 1ʳᵉ exposition de chaque aliment, sur l'historique fourni (idéalement complet). */
export function firstExposureByFood(meals: MealWithDetails[]): Map<string, string> {
  const sorted = [...meals].sort((a, b) => a.date.localeCompare(b.date));
  const out = new Map<string, string>();
  for (const m of sorted) {
    for (const it of m.meal_items) {
      if (it.food && !out.has(it.food.id)) out.set(it.food.id, m.date);
    }
  }
  return out;
}

export type Kpis = {
  ratedMeals: number;
  distinctFoods: number;
  catalogSize: number;
  newFoods: number;
  acceptanceScore: number | null;
  observations: number;
};

/** Indicateurs clés sur la période sélectionnée. */
export function computeKpis(
  periodMeals: MealWithDetails[],
  firstExposure: Map<string, string>,
  periodStart: string,
  catalogSize: number,
): Kpis {
  const foodIds = new Set<string>();
  let ratedMeals = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let observations = 0;

  for (const m of periodMeals) {
    for (const it of m.meal_items) if (it.food) foodIds.add(it.food.id);
    observations += m.intake_observations.length;
    const score = mealScore(m.result);
    if (score !== null) {
      ratedMeals += 1;
      scoreSum += score;
      scoreCount += 1;
    }
  }

  let newFoods = 0;
  for (const dateISO of firstExposure.values()) {
    if (dateISO >= periodStart) newFoods += 1;
  }

  return {
    ratedMeals,
    distinctFoods: foodIds.size,
    catalogSize,
    newFoods,
    acceptanceScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : null,
    observations,
  };
}

export type CategoryCount = { category: FoodCategory; count: number; pct: number };

/** Répartition des aliments servis (occurrences) par catégorie sur la période. */
export function categoryBreakdown(periodMeals: MealWithDetails[]): CategoryCount[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const m of periodMeals) {
    for (const it of m.meal_items) {
      const cat = (it.food?.category ?? "autre") as FoodCategory;
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
      total += 1;
    }
  }
  return CATEGORY_ORDER.map((cat) => {
    const count = counts.get(cat) ?? 0;
    return { category: cat, count, pct: total ? Math.round((count / total) * 100) : 0 };
  }).filter((c) => c.count > 0);
}

export type AcceptanceByCategory = {
  category: FoodCategory;
  bien: number;
  moyen: number;
  refuse: number;
  total: number;
};

/** Répartition bien/moyen/refusé par catégorie, sur les repas évalués de la période. */
export function acceptanceByCategory(periodMeals: MealWithDetails[]): AcceptanceByCategory[] {
  const agg = new Map<string, { bien: number; moyen: number; refuse: number }>();
  for (const m of periodMeals) {
    if (!m.result) continue;
    const result = m.result;
    for (const it of m.meal_items) {
      const cat = (it.food?.category ?? "autre") as FoodCategory;
      const cur = agg.get(cat) ?? { bien: 0, moyen: 0, refuse: 0 };
      cur[result] += 1;
      agg.set(cat, cur);
    }
  }
  return CATEGORY_ORDER.map((cat) => {
    const c = agg.get(cat) ?? { bien: 0, moyen: 0, refuse: 0 };
    return { category: cat, ...c, total: c.bien + c.moyen + c.refuse };
  }).filter((c) => c.total > 0);
}

export type FoodScoreRow = {
  foodId: string;
  name: string;
  category: string | null;
  isAllergen: boolean;
  exposures: number;
  score: number;
};

/** Aliments les mieux / moins bien acceptés sur la période (min. `minExposures` prises notées). */
export function topFoods(
  periodMeals: MealWithDetails[],
  opts: { minExposures?: number; limit?: number } = {},
): { best: FoodScoreRow[]; hardest: FoodScoreRow[] } {
  const minExposures = opts.minExposures ?? 2;
  const limit = opts.limit ?? 6;

  const agg = new Map<
    string,
    { name: string; category: string | null; isAllergen: boolean; exp: number; pts: number; rated: number }
  >();
  for (const m of periodMeals) {
    const score = mealScore(m.result);
    for (const it of m.meal_items) {
      if (!it.food) continue;
      const cur = agg.get(it.food.id) ?? {
        name: it.food.name,
        category: it.food.category,
        isAllergen: it.food.is_allergen,
        exp: 0,
        pts: 0,
        rated: 0,
      };
      cur.exp += 1;
      if (score !== null) {
        cur.pts += score;
        cur.rated += 1;
      }
      agg.set(it.food.id, cur);
    }
  }

  const rows: FoodScoreRow[] = [];
  for (const [foodId, c] of agg) {
    if (c.rated === 0 || c.exp < minExposures) continue;
    rows.push({
      foodId,
      name: c.name,
      category: c.category,
      isAllergen: c.isAllergen,
      exposures: c.exp,
      score: Math.round(c.pts / c.rated),
    });
  }

  const best = [...rows].sort((a, b) => b.score - a.score || b.exposures - a.exposures).slice(0, limit);
  const hardest = [...rows].sort((a, b) => a.score - b.score || b.exposures - a.exposures).slice(0, limit);
  return { best, hardest };
}

export type AllergenCoverage = {
  introducedCount: number;
  totalCount: number;
  observationsCount: number;
};

/** Couverture des allergènes — métrique de sécurité, toujours calculée sur tout l'historique. */
export function allergenCoverage(
  allMeals: MealWithDetails[],
  allergensCatalogSize: number,
): AllergenCoverage {
  const introduced = new Set<string>();
  let observations = 0;
  for (const m of allMeals) {
    for (const a of m.meal_allergens) if (a.allergen) introduced.add(a.allergen.id);
    observations += m.intake_observations.length;
  }
  return {
    introducedCount: introduced.size,
    totalCount: allergensCatalogSize,
    observationsCount: observations,
  };
}

type Granularity = "day" | "week" | "month";

function granularityFor(spanDays: number): Granularity {
  if (spanDays <= 31) return "day";
  if (spanDays <= 180) return "week";
  return "month";
}

function bucketStart(date: Date, granularity: Granularity): Date {
  if (granularity === "day") return date;
  if (granularity === "week") return startOfWeek(date);
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function stepBucket(date: Date, granularity: Granularity): Date {
  if (granularity === "day") return addDays(date, 1);
  if (granularity === "week") return addDays(date, 7);
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

const dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const monthFmt = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "numeric" });

function bucketLabel(date: Date, granularity: Granularity): string {
  if (granularity === "month") return monthFmt.format(date);
  if (granularity === "week") return `sem. ${dayFmt.format(date)}`;
  return dayFmt.format(date);
}

export type DiversityPoint = {
  bucketISO: string;
  label: string;
  newFoods: number;
  cumulativeFoods: number;
};

/**
 * Croissance du répertoire alimentaire (nombre cumulé d'aliments distincts déjà
 * proposés) sur la période, avec le détail des nouveautés par intervalle.
 * `firstExposure` doit être calculé sur l'historique complet (pas seulement la
 * période) pour que le cumul de départ (`baseline`) soit correct.
 */
export function diversityOverTime(
  firstExposure: Map<string, string>,
  periodStart: string,
  periodEnd: string,
): DiversityPoint[] {
  const spanDays = Math.round(
    (new Date(`${periodEnd}T00:00:00`).getTime() - new Date(`${periodStart}T00:00:00`).getTime()) /
      86_400_000,
  ) + 1;
  const granularity = granularityFor(spanDays);

  let baseline = 0;
  const newByBucket = new Map<string, number>();
  for (const dateISO of firstExposure.values()) {
    if (dateISO < periodStart) {
      baseline += 1;
      continue;
    }
    if (dateISO > periodEnd) continue;
    const key = toISODate(bucketStart(new Date(`${dateISO}T00:00:00`), granularity));
    newByBucket.set(key, (newByBucket.get(key) ?? 0) + 1);
  }

  const points: DiversityPoint[] = [];
  let cursor = bucketStart(new Date(`${periodStart}T00:00:00`), granularity);
  const end = new Date(`${periodEnd}T00:00:00`);
  let cumulative = baseline;
  while (cursor <= end) {
    const key = toISODate(cursor);
    const n = newByBucket.get(key) ?? 0;
    cumulative += n;
    points.push({ bucketISO: key, label: bucketLabel(cursor, granularity), newFoods: n, cumulativeFoods: cumulative });
    cursor = stepBucket(cursor, granularity);
  }
  return points;
}
