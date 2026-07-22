import { createClient } from "@/lib/supabase/server";

export type MealMoment = {
  id: string;
  label: string;
  position: number;
};

/** Moments de repas du foyer, ordonnés. */
export async function getMealMoments(): Promise<MealMoment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_moments")
    .select("id, label, position")
    .order("position", { ascending: true });

  if (error) {
    console.error("getMealMoments:", error.message);
    return [];
  }
  return data ?? [];
}
