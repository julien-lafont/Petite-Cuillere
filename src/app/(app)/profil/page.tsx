import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyProfile } from "@/lib/data/profile";
import { ProfileForm } from "@/components/profile-form";
import { UserRound } from "lucide-react";

export default async function Page() {
  const profile = await getMyProfile();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Mon profil
        </h1>
        {profile?.email && (
          <p className="text-muted-foreground">{profile.email}</p>
        )}
      </div>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-primary" />
            Identité
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm prenom={profile?.prenom ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
