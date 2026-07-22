import { createClient } from "@/lib/supabase/server";

/** Aliments cochés (achetés) pour une semaine donnée (lundi ISO). */
export async function getShoppingChecks(weekStartISO: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_checks")
    .select("food_id")
    .eq("week_start", weekStartISO);

  if (error) {
    console.error("getShoppingChecks:", error.message);
    return [];
  }
  return (data ?? []).map((r) => r.food_id as string);
}
