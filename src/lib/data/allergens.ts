import { createClient } from "@/lib/supabase/server";

export type AllergenRow = {
  id: string;
  name: string;
  type: string | null;
  intro_window: string | null;
  note: string | null;
  household_id: string | null;
};

/** Catalogue d'allergènes visible par le foyer (commun + propres). */
export async function getAllergens(): Promise<AllergenRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allergens")
    .select("id, name, type, intro_window, note, household_id")
    .order("name", { ascending: true });

  if (error) {
    console.error("getAllergens:", error.message);
    return [];
  }
  return data ?? [];
}

export type AllergenIntroduction = {
  allergen_id: string;
  first_tried_on: string | null;
  had_reaction: boolean;
};

/**
 * Expositions aux allergènes déclarées au rattrapage (onboarding), avec le drapeau
 * « réaction observée ». Complète les expositions déduites des repas passés.
 */
export async function getAllergenIntroductions(
  babyId: string,
): Promise<AllergenIntroduction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allergen_introductions")
    .select("allergen_id, first_tried_on, had_reaction")
    .eq("baby_id", babyId);

  if (error) {
    console.error("getAllergenIntroductions:", error.message);
    return [];
  }
  return data ?? [];
}
