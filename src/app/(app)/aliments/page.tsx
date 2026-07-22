import { Carrot } from "lucide-react";
import { ageBetween, getAgeInfo, resolveReferenceDate } from "@/lib/age";
import { inSeason, formatSeason } from "@/lib/season";
import { toISODate } from "@/lib/dates";
import { getCurrentBaby } from "@/lib/data/baby";
import { getFoods } from "@/lib/data/foods";
import { getFoodStats } from "@/lib/data/food-stats";
import { AlimentsView, type AlimentRow } from "@/components/aliments-view";

export default async function Page() {
  const baby = await getCurrentBaby();
  if (!baby) return null;

  const today = new Date();
  const todayISO = toISODate(today);
  const month = today.getMonth() + 1;

  const birth = new Date(baby.date_naissance);
  const due = baby.date_terme ? new Date(baby.date_terme) : null;
  const ageRef = baby.age_reference_date
    ? new Date(baby.age_reference_date)
    : null;
  const ageMonths = ageBetween(resolveReferenceDate(birth, due, ageRef)).months;
  const age = getAgeInfo(birth, due, ageRef);

  const [foods, stats] = await Promise.all([
    getFoods(),
    getFoodStats(baby.id, todayISO),
  ]);

  const rows: AlimentRow[] = foods.map((f) => {
    const st = stats.get(f.id);
    const exposures = st?.exposures ?? 0;
    const score = st?.score ?? null;
    const status: AlimentRow["status"] =
      exposures > 0
        ? "introduit"
        : (f.age_introduction_min ?? 0) <= ageMonths
          ? "maintenant"
          : "avenir";
    return {
      id: f.id,
      name: f.name,
      category: f.category,
      ageMin: f.age_introduction_min,
      isAllergen: f.is_allergen,
      texture: f.texture,
      preparation: f.preparation,
      quantite: f.quantite_indicative,
      restrictions: f.restrictions,
      hasSeason: !!(f.season && f.season.length),
      seasonLabel: formatSeason(f.season),
      inSeason: inSeason(f.season, month, 1),
      status,
      exposures,
      score,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight md:text-3xl">
          Aliments
        </h1>
        <p className="mt-1 text-muted-foreground">
          Le catalogue de {baby.prenom} ({age.effective}) : déjà introduits, à
          proposer maintenant, et à venir.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <Carrot className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-heading font-bold">Catalogue vide</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lance le script{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
              supabase/reset.sql
            </code>{" "}
            dans Supabase pour remplir le catalogue.
          </p>
        </div>
      ) : (
        <AlimentsView rows={rows} />
      )}

      <p className="text-center text-xs text-muted-foreground">
        Repère d&apos;organisation, pas un avis médical.
      </p>
    </div>
  );
}
