import { AppShell } from "@/components/app-shell";
import { Onboarding } from "@/components/onboarding";
import { createClient } from "@/lib/supabase/server";
import { getCurrentBaby } from "@/lib/data/baby";

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

  const baby = await getCurrentBaby();
  if (!baby) return <Onboarding />;

  return (
    <AppShell
      userEmail={user?.email ?? null}
      userPrenom={profile?.prenom ?? null}
      baby={{
        prenom: baby.prenom,
      }}
    >
      {children}
    </AppShell>
  );
}
