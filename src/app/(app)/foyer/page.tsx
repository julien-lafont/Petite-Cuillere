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
 * Le foyer, dans l'ordre où on se le représente : soi, puis ses enfants, puis
 * les personnes à qui on confie les repas.
 *
 * L'ancienne page « Mon profil » a été absorbée ici (elle ne portait qu'un
 * prénom, ce qui ne justifiait ni une page, ni une entrée de navigation) ;
 * `/profil` redirige désormais vers cet écran.
 */
export default async function Page() {
  const baby = await getActiveBaby();
  if (!baby) return null; // le layout affiche l'onboarding si aucun bébé

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
       * « Vous » reste la plus légère des trois cartes : elle ne contient qu'un
       * prénom. Le contexte (email) tient dans le sous-titre, et le formulaire
       * sur une seule ligne. La déconnexion vit en bas de la barre latérale.
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

      {/* Enfants du foyer */}
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

      {/* Aidants */}
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

      {/* Moments de repas */}
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
       * Reprise mobile de la déconnexion : elle vit en bas de la barre latérale,
       * qui n'existe pas sur téléphone. Sans ce relais, il n'y aurait aucun
       * moyen de se déconnecter depuis un mobile.
       */}
      <div className="flex justify-center border-t pt-6 md:hidden">
        <SignOutButton variant="outline" />
      </div>
    </div>
  );
}
