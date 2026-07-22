"use server";

import { createClient } from "@/lib/supabase/server";

/** Coche (persiste) ou décoche un aliment de la liste de courses d'une semaine. */
export async function setShoppingCheck(
  weekStart: string,
  foodId: string,
  checked: boolean,
) {
  const supabase = await createClient();

  if (checked) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("household_id")
      .single();
    if (!profile) return;
    await supabase.from("shopping_checks").upsert(
      {
        household_id: profile.household_id,
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
