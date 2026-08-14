import { createClient } from "@/lib/supabase/server";
import type { Now } from "@/lib/clock";
import { isPastMeal, type TimedMoment } from "@/lib/moments";

export type FoodStat = {
  exposures: number; // number of past meals containing the food
  score: number | null; // liking 0-100 (null when no meal was rated)
  hasEffect: boolean; // an adverse effect was observed on a meal containing it
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
 * Per-food statistics **up to now**: exposure count, liking score (good=100 /
 * mixed=50 / refused=0), whether an adverse effect occurred.
 *
 * Three exclusions, and the third is what motivated the time slots:
 *
 *   · meals declared not given (`saute`);
 *   · foods unticked from an otherwise served meal — what was not eaten is not
 *     an exposure (suivi-reel-et-rattrapage §6);
 *   · **today's meals that have not happened yet**. Comparing dates counted
 *     tonight's dinner from 8am: broccoli was "discovered" before it was
 *     cooked, the "new" badge vanished from the card, and the programme thought
 *     itself a step further along than it was. `isPastMeal` decides on the
 *     clock — or on the parent's word, which wins (creneaux-horaires §5).
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
