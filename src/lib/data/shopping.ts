import { createClient } from "@/lib/supabase/server";

export type ShoppingChecks = {
  foodIds: string[];
  /**
   * When the week's first item was ticked, i.e. when the parent left to do the
   * shopping. Used to flag what entered the programme **after** that trip: the
   * plan may move, but not behind the back of someone who has already filled
   * their basket.
   */
  firstCheckedAt: string | null;
};

/** Foods ticked (bought) for a given week (ISO Monday). */
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
