"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Met à jour le prénom de l'utilisateur connecté (seul champ éditable). */
export async function updateMyProfile(
  prenom: string,
): Promise<{ error?: string }> {
  const nom = prenom.trim();
  if (!nom) return { error: "Le prénom est requis." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { error } = await supabase
    .from("profiles")
    .update({ prenom: nom })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {};
}
