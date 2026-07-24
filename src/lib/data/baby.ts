import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type BabyRow = {
  id: string;
  prenom: string;
  date_naissance: string;
  date_terme: string | null;
  age_reference_date: string | null;
  avatar_color: string | null;
  /** Pronom de l'enfant (« elle » | « il » | « iel »). NULL = neutre (profils anciens). */
  pronoun: string | null;
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
      "id, prenom, date_naissance, date_terme, age_reference_date, avatar_color, pronoun, household_id",
    )
    .order("created_at", { ascending: true });

  if (error) {
    console.error("getBabies:", error.message);
    return [];
  }
  return data ?? [];
}

/** L'enfant actif du foyer courant (cookie `active_baby_id`, sinon le premier). */
export async function getActiveBaby(): Promise<BabyRow | null> {
  const babies = await getBabies();
  const cookieStore = await cookies();
  return pickActiveBaby(babies, cookieStore.get(ACTIVE_BABY_COOKIE)?.value);
}
