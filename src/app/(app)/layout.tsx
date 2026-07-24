import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { Onboarding } from "@/components/onboarding";
import { createClient } from "@/lib/supabase/server";
import { getBabies, pickActiveBaby, ACTIVE_BABY_COOKIE } from "@/lib/data/baby";
import { getFoods } from "@/lib/data/foods";
import { getAllergens } from "@/lib/data/allergens";

/**
 * Layout des pages protégées : enveloppe le contenu dans la coquille (navigation)
 * et transmet l'utilisateur + le bébé. La protection d'accès (redirection vers
 * /login) est assurée par le proxy. Sans bébé en base → écran d'onboarding.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase.from("profiles").select("prenom").eq("id", user.id).single()
    : { data: null };

  const babies = await getBabies();
  if (babies.length === 0) {
    const [foods, allergens] = await Promise.all([getFoods(), getAllergens()]);
    return <Onboarding foods={foods} allergens={allergens} />;
  }

  const cookieStore = await cookies();
  const activeBaby = pickActiveBaby(
    babies,
    cookieStore.get(ACTIVE_BABY_COOKIE)?.value,
  )!;

  return (
    <AppShell
      userEmail={user?.email ?? null}
      userPrenom={profile?.prenom ?? null}
      babies={babies.map((b) => ({
        id: b.id,
        prenom: b.prenom,
        avatar_color: b.avatar_color,
      }))}
      activeBabyId={activeBaby.id}
    >
      {children}
    </AppShell>
  );
}
