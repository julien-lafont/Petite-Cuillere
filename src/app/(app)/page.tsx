import { getAgeInfo } from "@/lib/age";
import { getCurrentBaby } from "@/lib/data/baby";
import { getMealMoments } from "@/lib/data/meal-moments";
import { getMealsBetween } from "@/lib/data/meals";
import { getFoodStats } from "@/lib/data/food-stats";
import { addDays, toISODate } from "@/lib/dates";
import { TodayMeals } from "@/components/today-meals";
import { UpcomingDays } from "@/components/upcoming-days";

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default async function Page() {
  const baby = await getCurrentBaby();
  if (!baby) return null;

  const age = getAgeInfo(
    new Date(baby.date_naissance),
    baby.date_terme ? new Date(baby.date_terme) : null,
    baby.age_reference_date ? new Date(baby.age_reference_date) : null,
  );

  const today = new Date();
  const todayISO = toISODate(today);
  const lastISO = toISODate(addDays(today, 7));

  const [moments, meals, stats] = await Promise.all([
    getMealMoments(),
    getMealsBetween(baby.id, todayISO, lastISO),
    getFoodStats(baby.id, todayISO),
  ]);
  const scores: Record<string, number> = {};
  const introducedIds: string[] = [];
  for (const [id, s] of stats) {
    if (s.score !== null) scores[id] = s.score;
    if (s.exposures > 0) introducedIds.push(id);
  }

  const todayMeals = meals.filter((m) => m.date === todayISO);
  const upcomingMeals = meals.filter((m) => m.date > todayISO);
  const upcomingDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i + 1);
    return { dateISO: toISODate(d), dateLabel: dayFmt.format(d) };
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium capitalize text-muted-foreground">
          {dayFmt.format(today)}
        </p>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight md:text-3xl">
          En cuisine 🍽️
        </h1>
        <p className="mt-1 text-muted-foreground">
          Tout ce qu&apos;il faut pour préparer les repas de {baby.prenom} (
          {age.effective}).
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Aujourd&apos;hui</h2>
        <TodayMeals
          babyId={baby.id}
          date={todayISO}
          dateLabel={dayFmt.format(today)}
          moments={moments}
          meals={todayMeals}
          scores={scores}
          introducedIds={introducedIds}
        />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">Les 7 prochains jours</h2>
        <UpcomingDays
          moments={moments}
          days={upcomingDays}
          meals={upcomingMeals}
          scores={scores}
          introducedIds={introducedIds}
        />
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Repère d&apos;organisation, pas un avis médical.
      </p>
    </div>
  );
}
