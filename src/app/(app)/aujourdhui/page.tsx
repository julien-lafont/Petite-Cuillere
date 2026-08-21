import { getAgeInfo } from "@/lib/age";
import { getActiveBaby } from "@/lib/data/baby";
import { getNow } from "@/lib/data/household";
import { getMealMoments } from "@/lib/data/meal-moments";
import {
  getMealsBetween,
  countUpcomingByFood,
  hasAnyMeal,
} from "@/lib/data/meals";
import { getFoods } from "@/lib/data/foods";
import { getFoodStats } from "@/lib/data/food-stats";
import { getWeekBriefing } from "@/lib/data/week-briefing";
import { addISODays } from "@/lib/clock";
import { fromISODate, toISODate, weekDays } from "@/lib/dates";
import { awaitsSignalAt } from "@/lib/moments";
import { TodayMeals } from "@/components/today-meals";
import { UpcomingDays } from "@/components/upcoming-days";
import { WeekBriefingReminder } from "@/components/week-briefing";
import { CatchUpStrip, type PendingMeal } from "@/components/catch-up-strip";
import { VoiceLauncher } from "@/components/voice-launcher";

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Catch-up window: the two **completed** days before today. Beyond that the
 * strip disappears on its own — a parent away for a week must not come back to
 * fifteen overdue rows (see docs/feats/suivi-reel §4.4).
 *
 * The current day used to be included, with the time slots, so a meal from this
 * morning did not wait for midnight. It is out again: the day thread sits just
 * below and already shows those meals — their row says "à renseigner", and a tap
 * opens the full gesture. The strip repeated them identically, targets included,
 * so the same lunch was asked about twice on one screen. Catch-up goes back to
 * its original role: what the day screen can no longer show, because that day is
 * over.
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

  const now = await getNow();
  const todayISO = now.todayISO;
  const today = fromISODate(todayISO);
  const catchUpFromISO = addISODays(todayISO, -CATCH_UP_DAYS);
  const catchUpToISO = addISODays(todayISO, -1);
  const lastISO = addISODays(todayISO, 7);
  const monthISO = addISODays(todayISO, 30); // horizon batch cooking

  const moments = await getMealMoments();

  const [meals, foods, stats, upcomingCounts, anyMeal] = await Promise.all([
    // We go back two days for the catch-up strip.
    getMealsBetween(baby.id, catchUpFromISO, lastISO),
    getFoods(),
    getFoodStats(baby.id, now, moments),
    countUpcomingByFood(baby.id, todayISO, monthISO),
    hasAnyMeal(baby.id),
  ]);

  // "Ma semaine" banner reminder: pinned to the current week's Sunday.
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

  // The thread shows today — unless today carries nothing, in which case it
  // falls forward onto the next day that does. A program set to start tomorrow
  // otherwise opened on an empty page telling the parent to build the program
  // they had just built; the day ahead is the answer to the question they came
  // with. An empty meal row is not a day: `TodayMeals` only shows the moments
  // that have items, and the fallback has to agree with it.
  const plannedDays = new Set(
    meals.filter((m) => m.meal_items.length > 0).map((m) => m.date),
  );
  const aheadISO = plannedDays.has(todayISO)
    ? null
    : (Array.from({ length: 7 }, (_, i) => addISODays(todayISO, i + 1)).find(
        (dateISO) => plannedDays.has(dateISO),
      ) ?? null);
  const threadISO = aheadISO ?? todayISO;
  // « demain, jeudi 14 août » : the relative word first, the date to settle it.
  const aheadLabel = aheadISO
    ? `${aheadISO === addISODays(todayISO, 1) ? "demain, " : ""}${dayFmt.format(
        fromISODate(aheadISO),
      )}`
    : null;

  const threadMeals = meals.filter((m) => m.date === threadISO);
  const upcomingMeals = meals.filter((m) => m.date > todayISO);
  // The day the thread took over is not listed a second time below it.
  const upcomingDays = Array.from({ length: 7 }, (_, i) => {
    const dateISO = addISODays(todayISO, i + 1);
    return { dateISO, dateLabel: dayFmt.format(fromISODate(dateISO)) };
  }).filter((day) => day.dateISO !== threadISO);

  // Meals whose time has passed and that nobody said anything about — the only
  // real signal we have. Days gone by only: today's are in their place in the
  // thread, just below.
  const momentById = new Map(moments.map((m) => [m.id, m]));
  const dayLabels = new Map(
    Array.from({ length: CATCH_UP_DAYS }, (_, i) => {
      const dateISO = addISODays(todayISO, -(i + 1));
      const label = ["hier", "avant-hier"][i];
      return [dateISO, label] as const;
    }),
  );
  const pending: PendingMeal[] = meals
    .filter(
      (m) =>
        m.meal_moment_id !== null &&
        momentById.has(m.meal_moment_id) &&
        m.date >= catchUpFromISO &&
        m.date <= catchUpToISO &&
        awaitsSignalAt(m, momentById.get(m.meal_moment_id)!, now),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        momentById.get(a.meal_moment_id!)!.startMinute -
          momentById.get(b.meal_moment_id!)!.startMinute,
    )
    .map((m) => ({
      date: m.date,
      dayLabel: dayLabels.get(m.date) ?? dayFmt.format(fromISODate(m.date)),
      momentId: m.meal_moment_id!,
      momentLabel: momentById.get(m.meal_moment_id!)!.label,
      meal: m,
    }));

  return (
    <div className="space-y-8">
      {/*
       * The mic sits in the header, no longer above the content.
       *
       * The cheapest gesture is still more expensive than speech: one sentence
       * replaces the meal card, "something else", two foods and OK (see
       * docs/feats/commande-vocale.md §1). But a 380 px call-to-action card
       * pushed the first meal 575 px down the page: the promise showed up where
       * the parent had come to look for something else.
       *
       * As a badge aligned with the title it costs no height — it fits inside
       * the header's — while keeping the first place the eye reaches after the
       * title. Large screens only: on a phone the mic lives in the bottom bar
       * (see `voice-launcher`, `voice-dock`).
       */}
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground capitalize">
            {dayFmt.format(today)}
          </p>
          <h1 className="mt-0.5 font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Pour {baby.prenom} aujourd'hui
          </h1>
          <p className="mt-1 text-muted-foreground">{age.effective}</p>
        </div>
        <VoiceLauncher />
      </header>

      {pending.length > 0 && (
        <CatchUpStrip
          babyId={baby.id}
          meals={pending}
          ageMonths={age.effectiveMonths}
          fromISO={catchUpFromISO}
          toISO={catchUpToISO}
        />
      )}

      <section className="space-y-3">
        {aheadLabel && (
          <div>
            <h2 className="font-heading text-lg font-semibold">
              Rien n'est prévu aujourd'hui
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              La prochaine journée de {baby.prenom}, c'est {aheadLabel}.
            </p>
          </div>
        )}
        <TodayMeals
          babyId={baby.id}
          date={threadISO}
          dateLabel={dayFmt.format(fromISODate(threadISO))}
          nowMinutes={aheadISO ? null : now.minutes}
          moments={moments}
          meals={threadMeals}
          ageMonths={age.effectiveMonths}
          introducedIds={introducedIds}
          upcomingCounts={upcomingCounts}
          foods={foods}
          birthDate={baby.date_naissance}
          dueDate={baby.date_terme}
          ageReferenceDate={baby.age_reference_date}
        />
      </section>

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
