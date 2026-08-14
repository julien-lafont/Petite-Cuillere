import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import type { Season } from "@/lib/season";

export type FoodRow = {
  id: string;
  name: string;
  category: string | null;
  age_introduction_min: number | null;
  is_allergen: boolean;
  allergen_type: string | null;
  texture: string | null;
  preparation: string | null;
  restrictions: string | null;
  quantite_indicative: string | null;
  cook_minutes: number | null;
  prep_note: string | null;
  /** 'vapeur' | 'eau' | 'aucune' — cf. migration 0019 et `lib/recipe.ts`. */
  cook_method: string | null;
  /** 'salé' | 'sucré' — host preparation; null = served on its own. */
  course: string | null;
  /** Served as is, never blended (dairy, a crust of bread). */
  served_apart: boolean | null;
  /**
   * Sits on a meal without taking a place in it: mustard, sesame paste, a pinch
   * of herbs. Never offered as a discovery — see migration 0023.
   */
  dose_only: boolean | null;
  /** Portion specific to the food — see migration 0021 and `lib/portions.ts`. */
  portion_label: string | null;
  portion_grams: number | null;
  /** Suggested discovery order — used by the programme generator. */
  intro_order: number | null;
  /** Allergen carried, as a foreign key. `allergen_type` is now display only. */
  allergen_id: string | null;
  season: Season;
  household_id: string | null;
};

const FOOD_SELECT =
  "id, name, category, age_introduction_min, is_allergen, allergen_type, texture, preparation, restrictions, quantite_indicative, cook_minutes, prep_note, cook_method, course, served_apart, dose_only, portion_label, portion_grams, intro_order, allergen_id, season, household_id";

/** Food catalogue visible to the household (common + its own), sorted by age then name. */
export async function getFoods(): Promise<FoodRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foods")
    .select(FOOD_SELECT)
    .order("age_introduction_min", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getFoods:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * The **common** food catalogue, read without a session — so callable from a
 * prerendered page, where `getFoods` would make the route dynamic by reading
 * cookies. Household-specific foods are invisible here: RLS does not open them
 * to the `anon` role (see `createPublicClient`).
 */
export async function getPublicFoods(): Promise<FoodRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("foods")
    .select(FOOD_SELECT)
    .order("age_introduction_min", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getPublicFoods:", error.message);
    return [];
  }
  return data ?? [];
}
