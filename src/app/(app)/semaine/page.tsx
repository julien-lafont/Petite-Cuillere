import { getCurrentBaby } from "@/lib/data/baby";
import { getMealMoments } from "@/lib/data/meal-moments";
import { getMealsBetween, hasAnyMeal } from "@/lib/data/meals";
import { getFoods } from "@/lib/data/foods";
import { getAllergens } from "@/lib/data/allergens";
import { weekDays, toISODate } from "@/lib/dates";
import { MenuView } from "@/components/menu-view";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const baby = await getCurrentBaby();
  if (!baby) return null;

  const { week } = await searchParams;
  const parsed = week ? new Date(`${week}T00:00:00`) : new Date();
  const base = isNaN(parsed.getTime()) ? new Date() : parsed;
  const days = weekDays(base).map(toISODate);
  const [moments, meals, foods, allergens, anyMeal] = await Promise.all([
    getMealMoments(),
    getMealsBetween(baby.id, days[0], days[6]),
    getFoods(),
    getAllergens(),
    hasAnyMeal(baby.id),
  ]);

  return (
    <div className="space-y-2">
      <MenuView
        hasAnyMeal={anyMeal}
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
      {anyMeal && (
        <p className="pt-4 text-center text-xs text-muted-foreground">
          Repère d&apos;organisation, pas un avis médical.
        </p>
      )}
    </div>
  );
}
