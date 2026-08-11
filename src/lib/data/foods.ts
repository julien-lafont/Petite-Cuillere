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
  /** 'vapeur' | 'eau' | 'aucune' — cf. migration 0019 et `lib/recipe.ts`. */
  cook_method: string | null;
  /** 'salé' | 'sucré' — préparation d'accueil ; null = se sert seul. */
  course: string | null;
  /** Se sert tel quel, jamais mixé (laitage, croûte de pain). */
  served_apart: boolean | null;
  /**
   * Se pose sur un repas sans y prendre de place : moutarde, purée de sésame,
   * pincée d'herbes. Jamais proposé en découverte — cf. migration 0023.
   */
  dose_only: boolean | null;
  /** Portion propre à l'aliment — cf. migration 0021 et `lib/portions.ts`. */
  portion_label: string | null;
  portion_grams: number | null;
  /** Ordre de découverte conseillé — utilisé par le générateur de programme. */
  intro_order: number | null;
  /** Allergène porté, en clé étrangère. `allergen_type` ne sert plus qu'à l'affichage. */
  allergen_id: string | null;
  season: Season;
  household_id: string | null;
};

/** Catalogue d'aliments visible par le foyer (commun + propres), trié par âge puis nom. */
export async function getFoods(): Promise<FoodRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foods")
    .select(
      "id, name, category, age_introduction_min, is_allergen, allergen_type, texture, preparation, restrictions, quantite_indicative, cook_minutes, prep_note, cook_method, course, served_apart, dose_only, portion_label, portion_grams, intro_order, allergen_id, season, household_id",
    )
    .order("age_introduction_min", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("getFoods:", error.message);
    return [];
  }
  return data ?? [];
}
