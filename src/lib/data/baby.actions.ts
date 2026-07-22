"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Crée le profil bébé du foyer courant (action serveur, appelée par un formulaire). */
export async function createBaby(formData: FormData) {
  const prenom = String(formData.get("prenom") ?? "").trim();
  const dateNaissance = String(formData.get("date_naissance") ?? "");
  const dateTerme = String(formData.get("date_terme") ?? "");

  if (!prenom || !dateNaissance) return;

  const supabase = await createClient();

  // household_id du profil connecté (la RLS exige de le renseigner explicitement).
  const { data: profile } = await supabase
    .from("profiles")
    .select("household_id")
    .single();

  if (!profile) return;

  await supabase.from("babies").insert({
    household_id: profile.household_id,
    prenom,
    date_naissance: dateNaissance,
    date_terme: dateTerme || null,
  });

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Définit la date de référence de l'âge projeté du bébé (prématurés).
 * `isoDate` doit être entre la naissance et le terme ; null = valeur par défaut.
 */
export async function setAgeReferenceDate(
  babyId: string,
  isoDate: string | null,
) {
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
      date_terme: dateTerme || null,
    })
    .eq("id", babyId);
  revalidatePath("/", "layout");
}
