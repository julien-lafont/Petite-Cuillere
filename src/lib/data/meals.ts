import { createClient } from "@/lib/supabase/server";
import type { MealWithDetails } from "./meals.types";

export * from "./meals.types";

const MEAL_SELECT =
  "id, baby_id, date, meal_moment_id, result, note, " +
  "meal_items(id, food:foods(id, name, category, is_allergen, allergen_type, texture, preparation, quantite_indicative, restrictions, season)), " +
  "meal_allergens(id, allergen:allergens(id, name)), " +
  "intake_observations(id, effect_type, severity, delay, note, allergen_id, food_id)";

/** Le bébé a-t-il au moins un repas configuré (tout historique confondu) ? */
export async function hasAnyMeal(babyId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("meals")
    .select("id", { count: "exact", head: true })
    .eq("baby_id", babyId);

  if (error) {
    console.error("hasAnyMeal:", error.message);
    return true; // en cas d'erreur, on n'affiche pas l'onboarding par défaut
  }
  return (count ?? 0) > 0;
}

/** Repas d'un bébé entre deux dates incluses ('YYYY-MM-DD'). */
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
