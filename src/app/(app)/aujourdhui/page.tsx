import { getAgeInfo } from "@/lib/age";
import { getActiveBaby } from "@/lib/data/baby";
import { getMealMoments } from "@/lib/data/meal-moments";
import {
  getMealsBetween,
  countUpcomingByFood,
  hasAnyMeal,
} from "@/lib/data/meals";
import { getFoodStats } from "@/lib/data/food-stats";
import { getWeekBriefing } from "@/lib/data/week-briefing";
import { addDays, toISODate, weekDays } from "@/lib/dates";
import { TodayMeals } from "@/components/today-meals";
import { UpcomingDays } from "@/components/upcoming-days";
import { WeekBriefingReminder } from "@/components/week-briefing";

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default async function Page() {
  const baby = await getActiveBaby();
  if (!baby) return null;

  const age = getAgeInfo(
    new Date(baby.date_naissance),
    baby.date_terme ? new Date(baby.date_terme) : null,
    baby.age_reference_date ? new Date(baby.age_reference_date) : null,
  );

  const today = new Date();
  const todayISO = toISODate(today);
  const lastISO = toISODate(addDays(today, 7));
  const monthISO = toISODate(addDays(today, 30)); // horizon batch cooking

  const [moments, meals, stats, upcomingCounts, anyMeal] = await Promise.all([
    getMealMoments(),
    getMealsBetween(baby.id, todayISO, lastISO),
    getFoodStats(baby.id, todayISO),
    countUpcomingByFood(baby.id, todayISO, monthISO),
    hasAnyMeal(baby.id),
  ]);

  // Rappel du bandeau « Ma semaine » : calé sur le dimanche de la semaine en cours.
  const sundayISO = toISODate(weekDays(today)[6]);
  const briefing = anyMeal
    ? await getWeekBriefing(
        baby,
        moments.map((m) => m.label),
        sundayISO,
      )
    : null;
  const introducedIds: string[] = [];
  for (const [id, s] of stats) {
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
      <header>
        <p className="text-sm font-medium capitalize text-muted-foreground">
          {dayFmt.format(today)}
        </p>
        <h1 className="mt-0.5 font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Pour {baby.prenom} aujourd&apos;hui
        </h1>
        <p className="mt-1 text-muted-foreground">
          {age.effective} · tout est prêt, il n&apos;y a plus qu&apos;à
          cuisiner.
        </p>
      </header>

      <TodayMeals
        babyId={baby.id}
        date={todayISO}
        dateLabel={dayFmt.format(today)}
        moments={moments}
        meals={todayMeals}
        ageMonths={age.effectiveMonths}
        introducedIds={introducedIds}
        upcomingCounts={upcomingCounts}
      />

      {briefing && <WeekBriefingReminder briefing={briefing} />}

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-semibold">
          Les jours qui viennent
        </h2>
        <UpcomingDays
          moments={moments}
          days={upcomingDays}
          meals={upcomingMeals}
          ageMonths={age.effectiveMonths}
          introducedIds={introducedIds}
        />
      </section>
    </div>
  );
}
