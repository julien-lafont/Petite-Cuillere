"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TEXT_LIMITS, tooLongMessage } from "@/lib/limits";
import { userMessage } from "@/lib/data/errors";

/** Updates the signed-in user's first name (the only editable field). */
export async function updateMyProfile(
  prenom: string,
): Promise<{ error?: string }> {
  const nom = prenom.trim();
  if (!nom) return { error: "Le prénom est requis." };
  const tooLong = tooLongMessage([
    ["Le prénom", nom, TEXT_LIMITS.personPrenom],
  ]);
  if (tooLong) return { error: tooLong };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { error } = await supabase
    .from("profiles")
    .update({ prenom: nom })
    .eq("id", user.id);
  if (error) {
    return {
      error: userMessage(
        "updateMyProfile",
        error,
        "Impossible d'enregistrer ce prénom.",
      ),
    };
  }

  revalidatePath("/", "layout");
  return {};
}
