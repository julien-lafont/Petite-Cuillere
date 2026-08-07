import { createClient } from "@/lib/supabase/server";

export type ShoppingChecks = {
  foodIds: string[];
  /**
   * Date du premier article coché de la semaine, c'est-à-dire du moment où le
   * parent est parti faire ses courses. Sert à signaler ce qui est entré au
   * programme **après** ce passage : le plan a le droit de bouger, mais pas
   * dans le dos de quelqu'un qui a déjà rempli son panier.
   */
  firstCheckedAt: string | null;
};

/** Aliments cochés (achetés) pour une semaine donnée (lundi ISO). */
export async function getShoppingChecks(
  weekStartISO: string,
): Promise<ShoppingChecks> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shopping_checks")
    .select("food_id, created_at")
    .eq("week_start", weekStartISO)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getShoppingChecks:", error.message);
    return { foodIds: [], firstCheckedAt: null };
  }
  const rows = (data ?? []) as { food_id: string; created_at: string }[];
  return {
    foodIds: rows.map((r) => r.food_id),
    firstCheckedAt: rows[0]?.created_at ?? null,
  };
}
