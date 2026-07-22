"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Season } from "@/lib/season";

export type FoodInput = {
  name: string;
  category: string | null;
  ageIntroductionMin: number | null;
  isAllergen: boolean;
  allergenType: string | null;
  texture: string | null;
  preparation: string | null;
  restrictions: string | null;
  quantiteIndicative: string | null;
  season: Season;
};

export type CreateFoodResult = { id: string } | { error: string };

/** Crée un aliment dans le catalogue propre au foyer (jamais dans le catalogue commun). */
export async function createFood(input: FoodInput): Promise<CreateFoodResult> {
  const name = input.name.trim();
  if (!name) return { error: "Le nom est requis." };

  const supabase = await createClient();
  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) return { error: "Foyer introuvable." };

  const { data, error } = await supabase
    .from("foods")
    .insert({
      household_id: householdId,
      name,
      category: input.category,
      age_introduction_min: input.ageIntroductionMin,
      is_allergen: input.isAllergen,
      allergen_type: input.isAllergen ? input.allergenType : null,
      texture: input.texture,
      preparation: input.preparation,
      restrictions: input.restrictions,
      quantite_indicative: input.quantiteIndicative,
      season: input.season,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Impossible de créer l'aliment." };
  }

  revalidatePath("/aliments");
  return { id: data.id };
}
