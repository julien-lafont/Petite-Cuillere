"use server";

import { createClient } from "@/lib/supabase/server";

/** Ticks (persists) or unticks a food on a week's shopping list. */
export async function setShoppingCheck(
  weekStart: string,
  foodId: string,
  checked: boolean,
) {
  const supabase = await createClient();

  if (checked) {
    const { data: householdId } = await supabase.rpc("current_household_id");
    if (!householdId) return;
    await supabase.from("shopping_checks").upsert(
      {
        household_id: householdId,
        week_start: weekStart,
        food_id: foodId,
      },
      { onConflict: "household_id,week_start,food_id" },
    );
  } else {
    await supabase
      .from("shopping_checks")
      .delete()
      .eq("week_start", weekStart)
      .eq("food_id", foodId);
  }
}
