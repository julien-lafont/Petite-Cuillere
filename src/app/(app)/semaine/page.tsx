import { getActiveBaby } from "@/lib/data/baby";
import { getMealMoments } from "@/lib/data/meal-moments";
import { getMealsBetween, hasAnyMeal, getLastMealDate } from "@/lib/data/meals";
import { getFoods } from "@/lib/data/foods";
import { getAllergens } from "@/lib/data/allergens";
import { weekDays, toISODate } from "@/lib/dates";
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
  const parsed = week ? new Date(`${week}T00:00:00`) : new Date();
  const base = isNaN(parsed.getTime()) ? new Date() : parsed;
  const days = weekDays(base).map(toISODate);
  const [moments, meals, foods, allergens, anyMeal, lastMealDate] =
    await Promise.all([
      getMealMoments(),
      getMealsBetween(baby.id, days[0], days[6]),
      getFoods(),
      getAllergens(),
      hasAnyMeal(baby.id),
      getLastMealDate(baby.id),
    ]);

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
        briefing={briefing && <WeekBriefingCard briefing={briefing} />}
        babyName={baby.prenom}
        babyId={baby.id}
        days={days}
        moments={moments}
        meals={meals}
        foods={foods}
        allergens={allergens}
        birthDate={baby.date_naissance}
        dueDate={baby.date_terme}
        ageReferenceDate={baby.age_reference_date}
      />
    </div>
  );
}
