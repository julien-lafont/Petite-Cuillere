import { cookies } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { Onboarding } from "@/components/onboarding";
import { createClient } from "@/lib/supabase/server";
import { getBabies, pickActiveBaby, ACTIVE_BABY_COOKIE } from "@/lib/data/baby";
import { getFoods } from "@/lib/data/foods";
import { getAllergens } from "@/lib/data/allergens";
import { getHouseholdTimeZone } from "@/lib/data/household";
import { TimeZoneProbe } from "@/components/time-zone-probe";

/**
 * Layout for the protected pages: wraps the content in the shell (navigation)
 * and passes down the user and the baby. Access protection (redirect to /login)
 * is handled by the proxy. No baby in the database → onboarding screen.
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
    ? await supabase
        .from("profiles")
        .select("prenom")
        .eq("id", user.id)
        .single()
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
  const timeZone = await getHouseholdTimeZone();

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
      <TimeZoneProbe stored={timeZone} />
      {children}
    </AppShell>
  );
}
