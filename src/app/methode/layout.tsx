import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import { getBabies, pickActiveBaby, ACTIVE_BABY_COOKIE } from "@/lib/data/baby";

/**
 * Les deux pages « La méthode » vivent hors du groupe `(app)` : ce sont les
 * vues **connectées** de la méthode (prénom de l'enfant, catalogue du foyer),
 * mais elles restent ouvertes sans compte, parce qu'elles portaient les
 * adresses publiques avant que chaque page soit dédoublée — cf.
 * `src/lib/routes.ts`, qui explique le partage avec les versions prérendues
 * sous `/decouvrir`, seules indexées.
 *
 * La coquille s'adapte donc au visiteur : navigation complète pour qui est
 * connecté, en-tête public pour les autres.
 */
export default async function MethodeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const babies = user ? await getBabies() : [];

  // Connecté et déjà un enfant : on reste dans l'app, la page n'a pas à
  // ressembler à une sortie de parcours. Sinon, coquille publique.
  if (user && babies.length > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("prenom")
      .eq("id", user.id)
      .single();

    const cookieStore = await cookies();
    const activeBaby = pickActiveBaby(
      babies,
      cookieStore.get(ACTIVE_BABY_COOKIE)?.value,
    )!;

    return (
      <AppShell
        userEmail={user.email ?? null}
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      {/*
       * La largeur de colonne (`METHOD_COLUMN`) est posée par les pages
       * elles-mêmes, qui doivent aussi tenir dans l'AppShell. On se contente
       * donc ici des marges latérales et du rythme vertical.
       */}
      <main className="px-5 py-12 md:px-8 md:py-16">{children}</main>
      <SiteFooter />
    </div>
  );
}
