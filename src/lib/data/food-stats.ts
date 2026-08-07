import { createClient } from "@/lib/supabase/server";

export type FoodStat = {
  exposures: number; // nb de repas passés contenant l'aliment
  score: number | null; // appréciation 0-100 (null si aucun repas noté)
  hasEffect: boolean; // un effet indésirable a été observé sur un repas le contenant
};

type MealRow = {
  result: string | null;
  meal_items: { food_id: string; skipped: boolean }[];
  intake_observations: { id: string }[];
};

/**
 * Statistiques par aliment jusqu'à `todayISO` inclus : nombre d'expositions,
 * score d'appréciation (bien=100 / moyen=50 / refusé=0), présence d'effet.
 *
 * Les repas que le parent a déclarés non donnés sont exclus, ainsi que les
 * aliments décochés d'un repas par ailleurs servi : ce qui n'a pas été mangé
 * n'est pas une exposition (cf. docs/feats/suivi-reel-et-rattrapage.md §6).
 */
export async function getFoodStats(
  babyId: string,
  todayISO: string,
): Promise<Map<string, FoodStat>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meals")
    .select("result, meal_items(food_id, skipped), intake_observations(id)")
    .eq("baby_id", babyId)
    .neq("status", "saute")
    .lte("date", todayISO);

  if (error) {
    console.error("getFoodStats:", error.message);
    return new Map();
  }

  const agg = new Map<
    string,
    { exp: number; pts: number; rated: number; eff: boolean }
  >();
  for (const m of (data ?? []) as MealRow[]) {
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
