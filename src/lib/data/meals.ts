import { createClient } from "@/lib/supabase/server";
import type { MealWithDetails } from "./meals.types";

export * from "./meals.types";

const MEAL_SELECT =
  "id, baby_id, date, meal_moment_id, result, note, status, logged_at, locked, planned_food_ids, created_at, " +
  "meal_items(id, dose, source, skipped, food:foods(id, name, category, is_allergen, allergen_type, texture, preparation, quantite_indicative, cook_minutes, prep_note, cook_method, course, served_apart, dose_only, portion_label, portion_grams, restrictions, season)), " +
  "meal_allergens(id, allergen:allergens(id, name)), " +
  "intake_observations(id, effect_type, severity, delay, note, allergen_id, food_id)";

/** Does the baby have at least one meal set up, across the whole history? */
export async function hasAnyMeal(babyId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("meals")
    .select("id", { count: "exact", head: true })
    .eq("baby_id", babyId);

  if (error) {
    console.error("hasAnyMeal:", error.message);
    return true; // on error, do not show the onboarding by default
  }
  return (count ?? 0) > 0;
}

/** Date of the last planned meal ('YYYY-MM-DD'), or null when there is none. */
export async function getLastMealDate(babyId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meals")
    .select("date")
    .eq("baby_id", babyId)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getLastMealDate:", error.message);
    return null;
  }
  return (data?.date as string | undefined) ?? null;
}

/**
 * How many times each food comes up between two inclusive dates. Feeds the
 * batch-cooking hint ("this food comes back X times — make extra and freeze",
 * see docs/ux-redesign.md §5). The caller sets the monthly horizon.
 */
export async function countUpcomingByFood(
  babyId: string,
  startISO: string,
  endISO: string,
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meals")
    .select("date, meal_items(food_id)")
    .eq("baby_id", babyId)
    // A meal announced as not given (an absence declared ahead) must neither
    // weigh on the shopping nor inflate the freezing hint.
    .neq("status", "saute")
    .gte("date", startISO)
    .lte("date", endISO);

  if (error) {
    console.error("countUpcomingByFood:", error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const meal of (data ?? []) as { meal_items: { food_id: string }[] }[]) {
    for (const item of meal.meal_items) {
      if (item.food_id) counts[item.food_id] = (counts[item.food_id] ?? 0) + 1;
    }
  }
  return counts;
}

/** A baby's meals between two inclusive dates ('YYYY-MM-DD'). */
export async function getMealsBetween(
  babyId: string,
  startISO: string,
  endISO: string,
): Promise<MealWithDetails[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meals")
    .select(MEAL_SELECT)
    .eq("baby_id", babyId)
    .gte("date", startISO)
    .lte("date", endISO);

  if (error) {
    console.error("getMealsBetween:", error.message);
    return [];
  }
  return (data ?? []) as unknown as MealWithDetails[];
}
