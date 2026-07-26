import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveBaby, getBabies } from "@/lib/data/baby";
import { getMealMoments } from "@/lib/data/meal-moments";
import { getHelpers } from "@/lib/data/helpers";
import { BabyListManager } from "@/components/baby-list-manager";
import { HelpersManager } from "@/components/helpers-manager";
import { MealMomentsManager } from "@/components/meal-moments-manager";
import { FEATURE_CUSTOM_MEALS } from "@/lib/features";
import { Users, CalendarHeart, Utensils } from "lucide-react";

export default async function Page() {
  const baby = await getActiveBaby();
  if (!baby) return null; // le layout affiche l'onboarding si aucun bébé

  const [babies, moments, helpers] = await Promise.all([
    getBabies(),
    FEATURE_CUSTOM_MEALS ? getMealMoments() : [],
    getHelpers(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Mon foyer
        </h1>
        <p className="mt-1 text-muted-foreground">
          Les enfants suivis, les aidants et l'organisation partagée entre eux.
        </p>
      </div>

      {/* Enfants du foyer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            Enfants du foyer ({babies.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <BabyListManager babies={babies} activeBabyId={baby.id} />
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
    </div>
  );
}
