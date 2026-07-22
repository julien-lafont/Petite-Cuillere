import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAgeInfo } from "@/lib/age";
import { getCurrentBaby } from "@/lib/data/baby";
import { getMealMoments } from "@/lib/data/meal-moments";
import { SignOutButton } from "@/components/sign-out-button";
import { ProjectedAgeControl } from "@/components/projected-age-control";
import { EditBabyDialog } from "@/components/edit-baby-dialog";
import { MealMomentsManager } from "@/components/meal-moments-manager";
import { CalendarHeart, Baby, Info, UserPlus, Utensils } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/* Aidants de démonstration — nombre illimité, aucune hiérarchie. */
const AIDANTS = [
  { prenom: "Julien", relation: "Papa" },
  { prenom: "Marie", relation: "Maman" },
  { prenom: "Sylvie", relation: "Grand-mère" },
  { prenom: "Fatou", relation: "Nounou" },
];

function InfoTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-xl border border-primary/20 bg-primary/[0.06] p-4"
          : "rounded-xl border bg-card p-4"
      }
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-lg font-bold">{value}</p>
    </div>
  );
}

export default async function Page() {
  const baby = await getCurrentBaby();
  if (!baby) return null; // le layout affiche l'onboarding si aucun bébé

  const birthDate = new Date(baby.date_naissance);
  const dueDate = baby.date_terme ? new Date(baby.date_terme) : null;
  const ageRef = baby.age_reference_date
    ? new Date(baby.age_reference_date)
    : null;
  const age = getAgeInfo(birthDate, dueDate, ageRef);
  const initial = baby.prenom.charAt(0).toUpperCase();
  const moments = await getMealMoments();

  return (
    <div className="space-y-8">
      {/* En-tête : identité */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-secondary text-2xl font-extrabold text-secondary-foreground">
            {initial}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight">
              {baby.prenom}
            </h1>
            <p className="text-muted-foreground">
              {age.effective} · en pleine diversification
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SignOutButton variant="outline" />
          <EditBabyDialog
            babyId={baby.id}
            prenom={baby.prenom}
            dateNaissance={baby.date_naissance}
            dateTerme={baby.date_terme}
          />
        </div>
      </div>

      {/* Âges & dates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Baby className="size-4 text-primary" />
            Âge & dates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {age.isPremature ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoTile
                  label="Date de naissance"
                  value={dateFmt.format(birthDate)}
                />
                <InfoTile
                  label="Terme théorique"
                  value={dueDate ? dateFmt.format(dueDate) : "—"}
                />
                <InfoTile label="Âge réel" value={age.chronological} />
                <InfoTile
                  label="Âge corrigé"
                  value={age.corrected ?? "—"}
                />
              </div>

              <ProjectedAgeControl
                babyId={baby.id}
                birthDate={baby.date_naissance}
                dueDate={baby.date_terme!}
                ageReferenceDate={baby.age_reference_date}
              />

              <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4">
                <Info className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="text-sm">
                  <p className="font-medium">
                    {baby.prenom} est né·e {age.prematurityWeeks} semaines avant
                    le terme.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Tu peux définir ci-dessus l&apos;
                    <strong>âge projeté ({age.effective})</strong> utilisé partout
                    dans l&apos;app, entre l&apos;âge corrigé (plus fidèle à son
                    développement) et l&apos;âge réel.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoTile
                label="Date de naissance"
                value={dateFmt.format(birthDate)}
              />
              <InfoTile label="Âge" value={age.effective} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aidants */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarHeart className="size-4 text-primary" />
            Aidants ({AIDANTS.length})
          </CardTitle>
          <Button variant="ghost" size="sm" className="gap-2">
            <UserPlus className="size-4" />
            Inviter
          </Button>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Toutes les personnes qui s&apos;occupent de {baby.prenom} — sans
            limite, avec les mêmes droits.
          </p>
          <div className="divide-y">
            {AIDANTS.map((a, i) => (
              <div key={a.prenom} className="flex items-center gap-3 py-3">
                <span className="grid size-9 place-items-center rounded-full bg-muted text-sm font-bold">
                  {a.prenom.charAt(0)}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{a.prenom}</p>
                  <p className="text-xs text-muted-foreground">{a.relation}</p>
                </div>
                {i === 0 && <Badge variant="secondary">Vous</Badge>}
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <p className="text-center text-xs text-muted-foreground">
            La gestion réelle des aidants arrivera avec la connexion (itération 2).
          </p>
        </CardContent>
      </Card>

      {/* Moments de repas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Utensils className="size-4 text-primary" />
            Moments de repas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Personnalise les moments de la journée utilisés dans le calendrier et
            le journal (renommer, réordonner, ajouter, supprimer).
          </p>
          <MealMomentsManager moments={moments} />
        </CardContent>
      </Card>
    </div>
  );
}
