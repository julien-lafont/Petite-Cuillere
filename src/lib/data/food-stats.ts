import { createClient } from "@/lib/supabase/server";
import type { Now } from "@/lib/clock";
import { isPastMeal, type TimedMoment } from "@/lib/moments";

export type FoodStat = {
  exposures: number; // nb de repas passés contenant l'aliment
  score: number | null; // appréciation 0-100 (null si aucun repas noté)
  hasEffect: boolean; // un effet indésirable a été observé sur un repas le contenant
};

type MealRow = {
  date: string;
  status: string;
  meal_moment_id: string | null;
  result: string | null;
  meal_items: { food_id: string; skipped: boolean }[];
  intake_observations: { id: string }[];
};

/**
 * Statistiques par aliment **jusqu'à maintenant** : nombre d'expositions, score
 * d'appréciation (bien=100 / moyen=50 / refusé=0), présence d'effet.
 *
 * Trois exclusions, et la troisième est celle qui a motivé les créneaux :
 *
 *   · les repas déclarés non donnés (`saute`) ;
 *   · les aliments décochés d'un repas par ailleurs servi — ce qui n'a pas été
 *     mangé n'est pas une exposition (suivi-reel-et-rattrapage §6) ;
 *   · **les repas du jour qui n'ont pas encore eu lieu**. Comparer les dates
 *     faisait compter le dîner de ce soir dès 8 h du matin : le brocoli était
 *     « découvert » avant d'être cuisiné, la pastille « nouveauté » disparaissait
 *     de la fiche, et le programme se croyait un cran plus loin qu'il n'était.
 *     `isPastMeal` tranche à l'heure — ou au témoignage du parent, qui prime
 *     (creneaux-horaires §5).
 */
export async function getFoodStats(
  babyId: string,
  now: Now,
  moments: TimedMoment[],
): Promise<Map<string, FoodStat>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meals")
    .select(
      "date, status, meal_moment_id, result, meal_items(food_id, skipped), intake_observations(id)",
    )
    .eq("baby_id", babyId)
    .neq("status", "saute")
    .lte("date", now.todayISO);

  if (error) {
    console.error("getFoodStats:", error.message);
    return new Map();
  }

  const momentById = new Map(moments.map((m) => [m.id, m]));

  const agg = new Map<
    string,
    { exp: number; pts: number; rated: number; eff: boolean }
  >();
  for (const m of (data ?? []) as MealRow[]) {
    const moment = m.meal_moment_id
      ? (momentById.get(m.meal_moment_id) ?? null)
      : null;
    if (!isPastMeal(m, moment, now)) continue;

    const pts =
      m.result === "bien"
        ? 1
        : m.result === "moyen"
          ? 0.5
          : m.result === "refuse"
            ? 0
            : null;
    const eff = (m.intake_observations?.length ?? 0) > 0;
    for (const it of m.meal_items ?? []) {
      if (it.skipped) continue;
      const cur = agg.get(it.food_id) ?? {
        exp: 0,
        pts: 0,
        rated: 0,
        eff: false,
      };
      cur.exp += 1;
      if (pts !== null) {
        cur.pts += pts;
        cur.rated += 1;
      }
      if (eff) cur.eff = true;
      agg.set(it.food_id, cur);
    }
  }

  const out = new Map<string, FoodStat>();
  for (const [id, c] of agg) {
    out.set(id, {
      exposures: c.exp,
      score: c.rated > 0 ? Math.round((c.pts / c.rated) * 100) : null,
      hasEffect: c.eff,
    });
  }
  return out;
}
