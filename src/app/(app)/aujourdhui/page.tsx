import { getAgeInfo } from "@/lib/age";
import { getActiveBaby } from "@/lib/data/baby";
import { getMealMoments } from "@/lib/data/meal-moments";
import {
  getMealsBetween,
  countUpcomingByFood,
  hasAnyMeal,
} from "@/lib/data/meals";
import { getFoods } from "@/lib/data/foods";
import { getFoodStats } from "@/lib/data/food-stats";
import { getWeekBriefing } from "@/lib/data/week-briefing";
import { addDays, toISODate, weekDays } from "@/lib/dates";
import { awaitsSignal } from "@/lib/data/meals.types";
import { TodayMeals } from "@/components/today-meals";
import { UpcomingDays } from "@/components/upcoming-days";
import { WeekBriefingReminder } from "@/components/week-briefing";
import { CatchUpStrip, type PendingMeal } from "@/components/catch-up-strip";
import { VoiceComposer } from "@/components/voice-composer";

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Fenêtre de rattrapage : deux jours glissants, pas davantage. Au-delà, la
 * bande disparaît d'elle-même — un parent absent une semaine ne doit pas
 * retrouver quinze lignes en retard (cf. docs/feats/suivi-reel §4.4).
 */
const CATCH_UP_DAYS = 2;

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
  const catchUpFromISO = toISODate(addDays(today, -CATCH_UP_DAYS));
  const lastISO = toISODate(addDays(today, 7));
  const monthISO = toISODate(addDays(today, 30)); // horizon batch cooking

  const [moments, meals, foods, stats, upcomingCounts, anyMeal] =
    await Promise.all([
      getMealMoments(),
      // On remonte deux jours en arrière pour la bande de rattrapage.
      getMealsBetween(baby.id, catchUpFromISO, lastISO),
      getFoods(),
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

  // Repas passés restés sans signal — le seul indice réel dont on dispose.
  const momentById = new Map(moments.map((m) => [m.id, m]));
  const dayLabels = new Map(
    Array.from({ length: CATCH_UP_DAYS }, (_, i) => {
      const d = addDays(today, -(i + 1));
      return [toISODate(d), i === 0 ? "hier" : "avant-hier"] as const;
    }),
  );
  const pending: PendingMeal[] = meals
    .filter(
      (m) =>
        awaitsSignal(m, todayISO) &&
        m.date >= catchUpFromISO &&
        m.meal_moment_id &&
        momentById.has(m.meal_moment_id),
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((m) => ({
      date: m.date,
      dayLabel: dayLabels.get(m.date) ?? dayFmt.format(new Date(m.date)),
      momentId: m.meal_moment_id!,
      momentLabel: momentById.get(m.meal_moment_id!)!.label,
      meal: m,
    }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium capitalize text-muted-foreground">
          {dayFmt.format(today)}
        </p>
        <h1 className="mt-0.5 font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Pour {baby.prenom} aujourd'hui
        </h1>
        <p className="mt-1 text-muted-foreground">
          {age.effective} · tout est prêt, il n'y a plus qu'à cuisiner.
        </p>
      </header>

      {/*
       * Le geste le moins cher reste plus cher que la parole : une phrase
       * remplace la carte du repas, « autre chose », deux aliments et OK.
       * Placé au-dessus du rattrapage, parce qu'il le rend souvent inutile
       * (cf. docs/feats/commande-vocale.md §1).
       */}
      <VoiceComposer
        foods={foods}
        moments={moments}
        introducedIds={introducedIds}
        ageMonths={age.effectiveMonths}
      />

      {pending.length > 0 && (
        <CatchUpStrip
          babyId={baby.id}
          meals={pending}
          ageMonths={age.effectiveMonths}
          fromISO={catchUpFromISO}
          toISO={toISODate(addDays(today, -1))}
        />
      )}

      <TodayMeals
        babyId={baby.id}
        date={todayISO}
        dateLabel={dayFmt.format(today)}
        moments={moments}
        meals={todayMeals}
        ageMonths={age.effectiveMonths}
        introducedIds={introducedIds}
        upcomingCounts={upcomingCounts}
        foods={foods}
        birthDate={baby.date_naissance}
        dueDate={baby.date_terme}
        ageReferenceDate={baby.age_reference_date}
      />

      {briefing && (
        <WeekBriefingReminder briefing={briefing} babyName={baby.prenom} />
      )}

      <section className="space-y-3">
        <div>
          <h2 className="font-heading text-lg font-semibold">
            Les jours qui viennent
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Un coup d'œil pour anticiper les courses — les nouveaux allergènes
            sont signalés.
          </p>
        </div>
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
