import { createClient } from "@/lib/supabase/server";

export type HouseholdMember = {
  id: string;
  email: string | null;
  prenom: string | null;
  relation: string | null;
  isOwner: boolean;
  isMe: boolean;
};

export type PendingInvitation = {
  id: string;
  prenom: string;
  relation: string | null;
  /** When the link stops working (ISO). */
  expiresAt: string;
  /** Computed here: the server clock is the one that will refuse. */
  isExpired: boolean;
};

export type HelpersData = {
  members: HouseholdMember[];
  pending: PendingInvitation[];
  /** Is the current user the household owner? */
  isOwner: boolean;
};

/**
 * Helpers of the current household: signed-up members plus pending invitations.
 * The invitation `token` is never returned here (hidden at the privilege level);
 * only the owner can get it, through a dedicated action.
 *
 * An expired invitation stays in the list: the owner has to see it expired to
 * reissue it, otherwise they would wait for an answer that can no longer come.
 */
export async function getHelpers(): Promise<HelpersData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: household }, { data: profiles }, { data: invitations }] =
    await Promise.all([
      supabase.from("households").select("id, owner_id").maybeSingle(),
      supabase
        .from("profiles")
        .select("id, email, prenom, relation, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("invitations")
        .select("id, prenom, relation, accepted_at, expires_at")
        .order("created_at", { ascending: true }),
    ]);

  const ownerId = household?.owner_id ?? null;

  const members: HouseholdMember[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email,
    prenom: p.prenom,
    relation: p.relation,
    isOwner: p.id === ownerId,
    isMe: p.id === user?.id,
  }));

  const now = Date.now();
  const pending: PendingInvitation[] = (invitations ?? [])
    .filter((i) => !i.accepted_at)
    .map((i) => ({
      id: i.id,
      prenom: i.prenom,
      relation: i.relation,
      expiresAt: i.expires_at,
      isExpired: new Date(i.expires_at).getTime() <= now,
    }));

  return {
    members,
    pending,
    isOwner: !!user && ownerId === user.id,
  };
}
