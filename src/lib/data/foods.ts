import { createClient } from "@/lib/supabase/server";
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
  /** Ordre de découverte conseillé — utilisé par le générateur de programme. */
  intro_order: number | null;
  season: Season;
  household_id: string | null;
};

/** Catalogue d'aliments visible par le foyer (commun + propres), trié par âge puis nom. */
export async function getFoods(): Promise<FoodRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foods")
    .select(
      "id, name, category, age_introduction_min, is_allergen, allergen_type, texture, preparation, restrictions, quantite_indicative, cook_minutes, prep_note, intro_order, season, household_id",
    )
    .order("age_introduction_min", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getFoods:", error.message);
    return [];
  }
  return data ?? [];
}
