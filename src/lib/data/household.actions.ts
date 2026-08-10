"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { safeTimeZone } from "@/lib/clock";

/**
 * Enregistre le fuseau détecté par le navigateur.
 *
 * Aucun écran ne le demande : le parent n'a pas à savoir qu'un fuseau existe.
 * Le client n'appelle cette action que si la valeur détectée diffère de celle
 * déjà en base, si bien qu'en régime normal elle n'est jamais appelée
 * (cf. `TimeZoneProbe`).
 *
 * Le fuseau est celui du foyer, pas de l'appareil : le dernier membre à ouvrir
 * l'application depuis un autre pays le déplacerait. C'est accepté — un foyer
 * qui déménage a raison, et un aidant en voyage rentrera.
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
