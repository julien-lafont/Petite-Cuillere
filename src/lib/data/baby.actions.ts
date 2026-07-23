"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BABY_COOKIE } from "@/lib/data/baby";
import { FEATURE_PREMATURE_BABY_ENABLED } from "@/lib/features";

const ACTIVE_BABY_COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};

/**
 * Fragment `date_terme` d'un insert/update. Flag prématurés désactivé → colonne
 * omise : les formulaires ne la saisissent plus, et on évite d'effacer un terme
 * déjà renseigné avant la bascule.
 */
function dateTermeColumn(dateTerme: string) {
  return FEATURE_PREMATURE_BABY_ENABLED
    ? { date_terme: dateTerme || null }
    : {};
}

/** Crée le profil bébé du foyer courant (action serveur, appelée par un formulaire). */
export async function createBaby(formData: FormData) {
  const prenom = String(formData.get("prenom") ?? "").trim();
  const dateNaissance = String(formData.get("date_naissance") ?? "");
  const dateTerme = String(formData.get("date_terme") ?? "");

  if (!prenom || !dateNaissance) return;

  const supabase = await createClient();

  // household_id du profil connecté (la RLS exige de le renseigner explicitement).
  const { data: householdId } = await supabase.rpc("current_household_id");

  if (!householdId) return;

  const { data } = await supabase
    .from("babies")
    .insert({
      household_id: householdId,
      prenom,
      date_naissance: dateNaissance,
      ...dateTermeColumn(dateTerme),
    })
    .select("id")
    .single();

  if (data) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_BABY_COOKIE, data.id, ACTIVE_BABY_COOKIE_OPTS);
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Ajoute un enfant supplémentaire au foyer et le rend actif. Utilisé par le
 * sélecteur d'enfant (nav) et la page /bebe, une fois qu'un premier enfant existe déjà.
 */
export async function addBaby(
  prenom: string,
  dateNaissance: string,
  dateTerme: string,
): Promise<{ error?: string }> {
  const nom = prenom.trim();
  if (!nom || !dateNaissance) {
    return { error: "Le prénom et la date de naissance sont requis." };
  }

  const supabase = await createClient();
  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) return { error: "Foyer introuvable." };

  const { data, error } = await supabase
    .from("babies")
    .insert({
      household_id: householdId,
      prenom: nom,
      date_naissance: dateNaissance,
      ...dateTermeColumn(dateTerme),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Impossible d'ajouter l'enfant." };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BABY_COOKIE, data.id, ACTIVE_BABY_COOKIE_OPTS);

  revalidatePath("/", "layout");
  return {};
}

/** Définit l'enfant actif (cookie, propre à cet appareil). */
export async function setActiveBaby(babyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BABY_COOKIE, babyId, ACTIVE_BABY_COOKIE_OPTS);
  revalidatePath("/", "layout");
}

/**
 * Supprime un enfant du foyer (et en cascade ses repas, introductions, etc.).
 * Si c'était l'enfant actif, bascule sur un enfant restant (ou vide le cookie
 * si c'était le dernier — l'onboarding réapparaît alors).
 */
export async function deleteBaby(babyId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) return { error: "Foyer introuvable." };

  const { error } = await supabase.from("babies").delete().eq("id", babyId);
  if (error) return { error: error.message };

  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_BABY_COOKIE)?.value === babyId) {
    const { data: remaining } = await supabase
      .from("babies")
      .select("id")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (remaining) {
      cookieStore.set(ACTIVE_BABY_COOKIE, remaining.id, ACTIVE_BABY_COOKIE_OPTS);
    } else {
      cookieStore.delete(ACTIVE_BABY_COOKIE);
    }
  }

  revalidatePath("/", "layout");
  return {};
}

/**
 * Définit la date de référence de l'âge projeté du bébé (prématurés).
 * `isoDate` doit être entre la naissance et le terme ; null = valeur par défaut.
 * Sans le flag prématurés, l'âge projeté n'existe pas → no-op.
 */
export async function setAgeReferenceDate(
  babyId: string,
  isoDate: string | null,
) {
  if (!FEATURE_PREMATURE_BABY_ENABLED) return;
  const supabase = await createClient();
  await supabase
    .from("babies")
    .update({ age_reference_date: isoDate })
    .eq("id", babyId);
  revalidatePath("/", "layout");
}

/** Met à jour le profil bébé (prénom, dates). */
export async function updateBaby(
  babyId: string,
  prenom: string,
  dateNaissance: string,
  dateTerme: string,
) {
  if (!prenom.trim() || !dateNaissance) return;
  const supabase = await createClient();
  await supabase
    .from("babies")
    .update({
      prenom: prenom.trim(),
      date_naissance: dateNaissance,
      ...dateTermeColumn(dateTerme),
    })
    .eq("id", babyId);
  revalidatePath("/", "layout");
}
