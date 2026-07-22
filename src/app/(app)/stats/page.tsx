import { getCurrentBaby } from "@/lib/data/baby";
import { getMealsBetween } from "@/lib/data/meals";
import { getFoods } from "@/lib/data/foods";
import { getAllergens } from "@/lib/data/allergens";
import { toISODate } from "@/lib/dates";
import { getAgeInfo } from "@/lib/age";
import { StatsView } from "@/components/stats-view";

export default async function Page() {
  const baby = await getCurrentBaby();
  if (!baby) return null;

  const todayISO = toISODate(new Date());
  const [meals, foods, allergens] = await Promise.all([
    getMealsBetween(baby.id, baby.date_naissance, todayISO),
    getFoods(),
    getAllergens(),
  ]);

  const age = getAgeInfo(
    new Date(baby.date_naissance),
    baby.date_terme ? new Date(baby.date_terme) : null,
    baby.age_reference_date ? new Date(baby.age_reference_date) : null,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight md:text-3xl">
          Statistiques
        </h1>
        <p className="mt-1 text-muted-foreground">
          Le recul sur l&apos;alimentation de {baby.prenom} ({age.effective}) :
          répartition, diversité et appréciation.
        </p>
      </div>

      <StatsView
        meals={meals}
        catalogSize={foods.length}
        allergensCatalogSize={allergens.length}
        babyBirthISO={baby.date_naissance}
        todayISO={todayISO}
      />

      <p className="text-center text-xs text-muted-foreground">
        Repère d&apos;organisation, pas un avis médical.
      </p>
    </div>
  );
}
