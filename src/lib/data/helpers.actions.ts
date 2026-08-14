"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TEXT_LIMITS, tooLongMessage } from "@/lib/limits";
import { userMessage } from "@/lib/data/errors";

export type CreateInvitationResult =
  { id: string; token: string } | { error: string };

/**
 * Creates an invitation (owner only, through RLS). The inviter enters the
 * person's first name and relation. Returns the magic link `token`.
 */
export async function createInvitation(
  prenom: string,
  relation: string,
): Promise<CreateInvitationResult> {
  const nom = prenom.trim();
  if (!nom) return { error: "Le prénom est requis." };
  const tooLong = tooLongMessage([
    ["Le prénom", nom, TEXT_LIMITS.personPrenom],
    ["La relation", relation.trim(), TEXT_LIMITS.personRelation],
  ]);
  if (tooLong) return { error: tooLong };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) return { error: "Foyer introuvable." };

  const { data, error } = await supabase
    .from("invitations")
    .insert({
      household_id: householdId,
      prenom: nom,
      relation: relation.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      error: userMessage(
        "createInvitation",
        error,
        "Impossible de créer l'invitation.",
      ),
    };
  }

  const token = await getInvitationToken(data.id);
  if (!token) return { error: "Invitation créée mais lien indisponible." };

  revalidatePath("/", "layout");
  return { id: data.id, token };
}

/** Returns the invitation link token (owner only). */
export async function getInvitationToken(
  invitationId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_invitation_token", {
    invitation_id: invitationId,
  });
  if (error) {
    console.error("getInvitationToken:", error.message);
    return null;
  }
  return (data as string | null) ?? null;
}

/** Cancels a pending invitation (owner only, through RLS). */
export async function deleteInvitation(invitationId: string) {
  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", invitationId);
  revalidatePath("/", "layout");
}

/** Removes a helper from the household (owner only). They leave with a fresh household. */
export async function removeHelper(
  profileId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_helper", {
    target_profile: profileId,
  });
  if (error) {
    return {
      error: userMessage(
        "removeHelper",
        error,
        "Impossible de retirer cet aidant.",
      ),
    };
  }
  revalidatePath("/", "layout");
  return {};
}

/** The signed-in user joins the household tied to this token. */
export async function acceptInvitation(
  token: string,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", {
    invite_token: token,
  });
  if (error) {
    return {
      error: userMessage(
        "acceptInvitation",
        error,
        "Impossible de rejoindre ce foyer.",
      ),
    };
  }
  revalidatePath("/", "layout");
  return {};
}
