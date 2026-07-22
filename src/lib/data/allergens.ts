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
