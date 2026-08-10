import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TIME_ZONE, nowIn, safeTimeZone, type Now } from "@/lib/clock";

/**
 * Le fuseau du foyer, et l'instant qui en découle.
 *
 * `cache()` déduplique l'appel pour toute la durée d'une requête : le layout le
 * demande, la page aussi, et parfois une action de lecture — une seule requête
 * part. C'est la lecture la plus fréquente de l'application, et elle passe par
 * la RLS comme les autres : un foyer ne lit que son horloge.
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
 * « Maintenant », vu du foyer. LA porte d'entrée du temps côté serveur : plus
 * aucun `new Date()` ne doit servir à situer une journée ou un repas
 * (docs/feats/creneaux-horaires.md §3.2).
 */
export async function getNow(): Promise<Now> {
  return nowIn(await getHouseholdTimeZone());
}
