import { createClient } from "@/lib/supabase/server";

export type MyProfile = {
  id: string;
  email: string | null;
  prenom: string | null;
};

/** Profile of the signed-in user. */
export async function getMyProfile(): Promise<MyProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, prenom")
    .eq("id", user.id)
    .single();

  return data ?? { id: user.id, email: user.email ?? null, prenom: null };
}
