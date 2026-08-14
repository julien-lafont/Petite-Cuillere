import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getActiveBaby, getBabies } from "@/lib/data/baby";
import { getMealMoments } from "@/lib/data/meal-moments";
import { getHelpers } from "@/lib/data/helpers";
import { getMyProfile } from "@/lib/data/profile";
import { BabyListManager } from "@/components/baby-list-manager";
import { HelpersManager } from "@/components/helpers-manager";
import { MealMomentsManager } from "@/components/meal-moments-manager";
import { ProfileForm } from "@/components/profile-form";
import { SignOutButton } from "@/components/sign-out-button";
import { FEATURE_CUSTOM_MEALS } from "@/lib/features";
import { Users, CalendarHeart, Utensils, UserRound } from "lucide-react";

/**
 * The household, in the order you picture it: yourself, then your children,
 * then the people you trust with the meals.
 *
 * The old "Mon profil" page was absorbed here (it carried only a first name,
 * which justified neither a page nor a navigation entry); `/profil` now
 * redirects to this screen.
 */
export default async function Page() {
  const baby = await getActiveBaby();
  if (!baby) return null; // the layout shows the onboarding when there is no baby

  const [babies, moments, helpers, profile] = await Promise.all([
    getBabies(),
    FEATURE_CUSTOM_MEALS ? getMealMoments() : [],
    getHelpers(),
    getMyProfile(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Mon foyer
        </h1>
        <p className="mt-1 text-muted-foreground">
          Vous, les enfants suivis, les aidants et l'organisation partagée entre
          eux.
        </p>
      </div>

      {/*
       * "Vous" stays the lightest of the three cards: it holds nothing but a
       * first name. The context (email) fits in the subtitle, and the form on a
       * single line. Signing out lives at the bottom of the sidebar.
       */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserRound className="size-4 text-primary" />
            Vous
          </CardTitle>
          <CardDescription>
            Le prénom que voient les autres aidants
            {profile?.email && ` · ${profile.email}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm prenom={profile?.prenom ?? null} />
        </CardContent>
      </Card>

      {/* Children of the household */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            Enfants du foyer ({babies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BabyListManager
            babies={babies}
            activeBabyId={baby.id}
            isOwner={helpers.isOwner}
          />
        </CardContent>
      </Card>

      {/* Helpers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarHeart className="size-4 text-primary" />
            Aidants ({helpers.members.length + helpers.pending.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <HelpersManager
            members={helpers.members}
            pending={helpers.pending}
            isOwner={helpers.isOwner}
            babyName={baby.prenom}
          />
        </CardContent>
      </Card>

      {/* Meal moments */}
      {FEATURE_CUSTOM_MEALS && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Utensils className="size-4 text-primary" />
              Moments de repas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Personnalise les moments de la journée utilisés dans le calendrier
              et le journal (renommer, réordonner, ajouter, supprimer).
            </p>
            <MealMomentsManager moments={moments} />
          </CardContent>
        </Card>
      )}

      {/*
       * Mobile fallback for signing out: it lives at the bottom of the sidebar,
       * which does not exist on a phone. Without this relay there would be no
       * way to sign out from mobile.
       */}
      <div className="flex justify-center border-t pt-6 md:hidden">
        <SignOutButton variant="outline" />
      </div>
    </div>
  );
}
