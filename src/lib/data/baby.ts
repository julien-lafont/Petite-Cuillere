import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { FEATURE_PREMATURE_BABY_ENABLED } from "@/lib/feature-flags";

export type BabyRow = {
  id: string;
  prenom: string;
  date_naissance: string;
  date_terme: string | null;
  age_reference_date: string | null;
  household_id: string;
};

/** Nom du cookie retenant l'enfant actif (par appareil, pas synchronisé entre membres). */
export const ACTIVE_BABY_COOKIE = "active_baby_id";

/** Choisit l'enfant actif parmi une liste déjà chargée : celui du cookie, sinon le premier. */
export function pickActiveBaby<T extends { id: string }>(
  babies: T[],
  activeId: string | undefined,
): T | null {
  if (babies.length === 0) return null;
  return babies.find((b) => b.id === activeId) ?? babies[0];
}

/** Tous les enfants du foyer courant, du plus ancien au plus récent. */
export async function getBabies(): Promise<BabyRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("babies")
    .select(
      "id, prenom, date_naissance, date_terme, age_reference_date, household_id",
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getBabies:", error.message);
    return [];
  }

  // Fonctionnalité désactivée : on ignore le terme théorique et l'âge projeté
  // pour tout le monde, même les profils créés quand elle était active.
  if (!FEATURE_PREMATURE_BABY_ENABLED) {
    return (data ?? []).map((b) => ({
      ...b,
      date_terme: null,
      age_reference_date: null,
    }));
  }

  return data ?? [];
}

/** L'enfant actif du foyer courant (cookie `active_baby_id`, sinon le premier). */
export async function getActiveBaby(): Promise<BabyRow | null> {
  const babies = await getBabies();
  const cookieStore = await cookies();
  return pickActiveBaby(babies, cookieStore.get(ACTIVE_BABY_COOKIE)?.value);
}
