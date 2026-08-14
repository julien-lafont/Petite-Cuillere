import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, nowIn, safeTimeZone, type Now } from "@/lib/clock";

/**
 * The household timezone, and the instant that follows from it.
 *
 * `cache()` dedupes the call for the whole request: the layout asks for it, the
 * page too, sometimes a read action as well — one query goes out. It is the
 * app's most frequent read, and it goes through RLS like the rest: a household
 * only reads its own clock.
 */
export const getHouseholdTimeZone = cache(async function (): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("households")
    .select("timezone")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getHouseholdTimeZone:", error.message);
    return DEFAULT_TIME_ZONE;
  }
  return safeTimeZone(data?.timezone as string | undefined);
});

/**
 * "Now", as the household sees it. THE server-side entry point for time: no
 * `new Date()` may be used to place a day or a meal any more
 * (docs/feats/creneaux-horaires.md §3.2).
 */
export async function getNow(): Promise<Now> {
  return nowIn(await getHouseholdTimeZone());
}
