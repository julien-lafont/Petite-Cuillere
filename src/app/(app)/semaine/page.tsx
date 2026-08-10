import { getActiveBaby } from "@/lib/data/baby";
import { getMealMoments } from "@/lib/data/meal-moments";
import { getMealsBetween, hasAnyMeal, getLastMealDate } from "@/lib/data/meals";
import { getFoods } from "@/lib/data/foods";
import { getAllergens } from "@/lib/data/allergens";
import { getFoodStats } from "@/lib/data/food-stats";
import { getNow } from "@/lib/data/household";
import { weekDays, toISODate, fromISODate } from "@/lib/dates";
import { programCoversFirstYear } from "@/lib/age";
import { getWeekBriefing } from "@/lib/data/week-briefing";
import { MenuView } from "@/components/menu-view";
import { WeekBriefingCard } from "@/components/week-briefing";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const baby = await getActiveBaby();
  if (!baby) return null;

  const { week } = await searchParams;
  const now = await getNow();
  const today = fromISODate(now.todayISO);
  const parsed = week ? new Date(`${week}T00:00:00`) : today;
  const base = isNaN(parsed.getTime()) ? today : parsed;
  const days = weekDays(base).map(toISODate);

  const moments = await getMealMoments();
  const [meals, foods, allergens, anyMeal, lastMealDate, stats] =
    await Promise.all([
      getMealsBetween(baby.id, days[0], days[6]),
      getFoods(),
      getAllergens(),
      hasAnyMeal(baby.id),
      getLastMealDate(baby.id),
      getFoodStats(baby.id, now, moments),
    ]);

  // Aliments déjà connus : la feuille de correction les propose en premier.
  const introducedIds = [...stats]
    .filter(([, s]) => s.exposures > 0)
    .map(([id]) => id);

  // Programme déjà couvert jusqu'au premier anniversaire (borne haute de
  // l'accompagnement) → plus rien à générer.
  const programComplete = programCoversFirstYear(
    lastMealDate,
    baby.date_naissance,
  );

  // Explication du programme pour la semaine affichée (calée sur le dimanche).
  const briefing = anyMeal
    ? await getWeekBriefing(
        baby,
        moments.map((m) => m.label),
        days[6],
      )
    : null;

  return (
    <div className="space-y-2">
      <MenuView
        hasAnyMeal={anyMeal}
        programComplete={programComplete}
        now={now}
        briefing={briefing && <WeekBriefingCard briefing={briefing} />}
        babyName={baby.prenom}
        babyId={baby.id}
        days={days}
        moments={moments}
        meals={meals}
        foods={foods}
        allergens={allergens}
        introducedIds={introducedIds}
        birthDate={baby.date_naissance}
        dueDate={baby.date_terme}
        ageReferenceDate={baby.age_reference_date}
      />
    </div>
  );
}
