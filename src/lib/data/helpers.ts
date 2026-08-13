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
  /** Fin de validité du lien (ISO). */
  expiresAt: string;
  /** Calculé ici : l'horloge du serveur est la même que celle qui refusera. */
  isExpired: boolean;
};

export type HelpersData = {
  members: HouseholdMember[];
  pending: PendingInvitation[];
  /** L'utilisateur courant est-il le responsable du foyer ? */
  isOwner: boolean;
};

/**
 * Aidants du foyer courant : membres inscrits + invitations en attente.
 * Le `token` d'invitation n'est jamais renvoyé ici (masqué au niveau des
 * privilèges) ; seul le responsable peut l'obtenir via une action dédiée.
 *
 * Une invitation périmée reste dans la liste : le responsable doit voir qu'elle
 * a expiré pour la refaire, sans quoi il attendrait une réponse qui ne peut
 * plus venir.
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
