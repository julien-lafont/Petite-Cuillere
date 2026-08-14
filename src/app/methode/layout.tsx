import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { createClient } from "@/lib/supabase/server";
import { getBabies, pickActiveBaby, ACTIVE_BABY_COOKIE } from "@/lib/data/baby";

/**
 * The two "La méthode" pages live outside the `(app)` group: they are the
 * **signed-in** views of the method (child's name, household catalogue), but
 * they stay open without an account, because they carried the public addresses
 * before each page was split in two — see `src/lib/routes.ts`, which explains
 * the split with the prerendered versions under `/decouvrir`, the only indexed
 * ones.
 *
 * The shell therefore adapts to the visitor: full navigation for whoever is
 * signed in, public header for everyone else.
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

  // Signed in and already has a child: stay inside the app, the page must not
  // look like an exit from the flow. Otherwise, the public shell.
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
       * The column width (`METHOD_COLUMN`) is set by the pages themselves, which
       * must also fit inside the AppShell. So we only handle side margins and
       * vertical rhythm here.
       */}
      <main className="px-5 py-12 md:px-8 md:py-16">{children}</main>
      <SiteFooter />
    </div>
  );
}
