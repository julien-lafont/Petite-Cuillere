"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeTimeZone } from "@/lib/clock";

/**
 * Records the timezone the browser detected.
 *
 * No screen asks for it: the parent should not have to know a timezone exists.
 * The client only calls this action when the detected value differs from the one
 * already stored, so in normal use it is never called (see `TimeZoneProbe`).
 *
 * The timezone belongs to the household, not the device: the last member to open
 * the app from another country would otherwise move it. That is accepted — a
 * household that moves is right, and a helper who is travelling will come home.
 */
export async function saveHouseholdTimeZone(timeZone: string): Promise<void> {
  const clean = safeTimeZone(timeZone);
  const supabase = await createClient();

  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) return;

  await supabase
    .from("households")
    .update({ timezone: clean })
    .eq("id", householdId as string);

  revalidatePath("/", "layout");
}
