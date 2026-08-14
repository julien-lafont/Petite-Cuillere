import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type BabyRow = {
  id: string;
  prenom: string;
  date_naissance: string;
  date_terme: string | null;
  age_reference_date: string | null;
  avatar_color: string | null;
  /** The child's sex ("fille" | "garcon"). NULL = not set (older profiles). */
  sexe: string | null;
  /**
   * Date of the first solid food. NULL = diversification has not started. This
   * is the clock for how long they have been at it: it drives the ramp that
   * opens meals, where `date_naissance` drives the ceilings (textures,
   * allergens).
   */
  diversification_started_on: string | null;
  /** Severe eczema or known egg allergy → peanut on medical advice (LEAP). */
  atopic_risk: boolean;
  household_id: string;
};

/** Cookie holding the active child (per device, not synced between members). */
export const ACTIVE_BABY_COOKIE = "active_baby_id";

/** Picks the active child from an already-loaded list: the cookie's, else the first. */
export function pickActiveBaby<T extends { id: string }>(
  babies: T[],
  activeId: string | undefined,
): T | null {
  if (babies.length === 0) return null;
  return babies.find((b) => b.id === activeId) ?? babies[0];
}

/** Every child of the current household, oldest to newest. */
export async function getBabies(): Promise<BabyRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("babies")
    .select(
      "id, prenom, date_naissance, date_terme, age_reference_date, avatar_color, sexe, diversification_started_on, atopic_risk, household_id",
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getBabies:", error.message);
    return [];
  }
  return data ?? [];
}

/** The household's active child (cookie `active_baby_id`, else the first). */
export async function getActiveBaby(): Promise<BabyRow | null> {
  const babies = await getBabies();
  const cookieStore = await cookies();
  return pickActiveBaby(babies, cookieStore.get(ACTIVE_BABY_COOKIE)?.value);
}
