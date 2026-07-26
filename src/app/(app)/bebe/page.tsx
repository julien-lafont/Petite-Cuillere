import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAgeInfo, diversificationStage } from "@/lib/age";
import { getActiveBaby } from "@/lib/data/baby";
import { ProjectedAgeControl } from "@/components/projected-age-control";
import { EditBabyDialog } from "@/components/edit-baby-dialog";
import { avatarStyle } from "@/lib/avatar-colors";
import { agree } from "@/lib/sexe";
import { Baby, Info } from "lucide-react";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

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
  const baby = await getActiveBaby();
  if (!baby) return null; // le layout affiche l'onboarding si aucun bébé

  const birthDate = new Date(baby.date_naissance);
  const dueDate = baby.date_terme ? new Date(baby.date_terme) : null;
  const ageRef = baby.age_reference_date
    ? new Date(baby.age_reference_date)
    : null;
  const age = getAgeInfo(birthDate, dueDate, ageRef);
  const initial = baby.prenom.charAt(0).toUpperCase();

  return (
    <div className="space-y-8">
      {/* En-tête : identité */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            style={avatarStyle(baby.avatar_color)}
            className="grid size-16 place-items-center rounded-2xl text-2xl font-semibold"
          >
            {initial}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {baby.prenom}
            </h1>
            <p className="text-muted-foreground">
              {age.effective} · {diversificationStage(age.effectiveMonths)}
            </p>
          </div>
        </div>
        <EditBabyDialog
          babyId={baby.id}
          prenom={baby.prenom}
          dateNaissance={baby.date_naissance}
          dateTerme={baby.date_terme}
          avatarColor={baby.avatar_color}
          sexe={baby.sexe}
        />
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
                <InfoTile label="Âge corrigé" value={age.corrected ?? "—"} />
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
                    {agree(baby.sexe, {
                      fille: `${baby.prenom} est née`,
                      garcon: `${baby.prenom} est né`,
                    })}{" "}
                    {age.prematurityWeeks} semaines avant le terme.
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Tu peux définir ci-dessus l'
                    <strong>âge projeté ({age.effective})</strong> utilisé
                    partout dans l'app, entre l'âge corrigé (plus fidèle à son
                    développement) et l'âge réel.
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
    </div>
  );
}
