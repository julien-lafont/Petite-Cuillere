import { UserX } from "lucide-react";
import { SpoonIcon } from "@/components/brand-mark";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JoinForm } from "@/components/join-form";

type InvitationDetails = {
  prenom: string;
  relation: string | null;
  household_name: string;
  is_pending: boolean;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="blob grid size-14 place-items-center bg-apricot text-apricot-foreground">
            <SpoonIcon className="size-7" />
          </div>
          <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight">
            Petite Cuillère
          </h1>
        </div>
        {children}
      </div>
    </main>
  );
}

/**
 * No `loading.tsx` here, even though the route is rendered on demand (see
 * AGENTS.md): it is only ever reached from an invitation email's link, never
 * from an in-app `<Link>`. So there is no previous page to prefetch a shell
 * from, and a skeleton would buy nothing.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase.rpc("invitation_details", {
    invite_token: token,
  });
  const info = (data as InvitationDetails[] | null)?.[0] ?? null;

  if (!info || !info.is_pending) {
    return (
      <Shell>
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <UserX className="size-10 text-muted-foreground" />
            <p className="mt-4 font-heading font-bold">Lien invalide</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cette invitation n'existe pas, a expiré, ou a déjà été utilisée.
              Demande un nouveau lien à la personne qui t'a invité·e.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const roleLabel = info.relation ? ` en tant que ${info.relation}` : "";

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bonjour {info.prenom} 👋</CardTitle>
          <CardDescription>
            Tu es invité·e à rejoindre le foyer{" "}
            <span className="font-medium text-foreground">
              {info.household_name}
            </span>
            {roleLabel} pour suivre l'alimentation de bébé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JoinForm
            token={token}
            loggedIn={!!user}
            householdName={info.household_name}
          />
        </CardContent>
      </Card>
    </Shell>
  );
}
