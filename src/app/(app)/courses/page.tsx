import { ShoppingCart } from "lucide-react";
import { getCurrentBaby } from "@/lib/data/baby";
import { getMealsBetween, type MealWithDetails } from "@/lib/data/meals";
import { weekDays, addDays, toISODate } from "@/lib/dates";
import { ShoppingList, type ShoppingItem } from "@/components/shopping-list";
import { getShoppingChecks } from "@/lib/data/shopping";
import { freshnessAdvice } from "@/lib/season";

/** Agrège les ingrédients d'un ensemble de repas (avec conseil frais/surgelé). */
function aggregate(meals: MealWithDetails[], month: number): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const meal of meals) {
    for (const item of meal.meal_items) {
      if (!item.food) continue;
      const existing = map.get(item.food.id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(item.food.id, {
          id: item.food.id,
          name: item.food.name,
          category: item.food.category,
          count: 1,
          advice: freshnessAdvice(item.food.season, month),
        });
      }
    }
  }
  return [...map.values()].sort(
    (a, b) =>
      (a.category ?? "").localeCompare(b.category ?? "") ||
      a.name.localeCompare(b.name),
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center">
      <ShoppingCart className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-2 text-sm text-muted-foreground">
        Aucun repas planifié — planifie-les sur l&apos;onglet Menu.
      </p>
    </div>
  );
}

export default async function Page() {
  const baby = await getCurrentBaby();
  if (!baby) return null;

  const days = weekDays(new Date()).map(toISODate);
  const thisStart = days[0];
  const thisEnd = days[6];
  const monday = new Date(`${thisStart}T00:00:00`);
  const nextStart = toISODate(addDays(monday, 7));
  const nextEnd = toISODate(addDays(monday, 13));

  const [meals, thisChecks, nextChecks] = await Promise.all([
    getMealsBetween(baby.id, thisStart, nextEnd),
    getShoppingChecks(thisStart),
    getShoppingChecks(nextStart),
  ]);
  const thisWeekMeals = meals.filter(
    (m) => m.date >= thisStart && m.date <= thisEnd,
  );
  const nextWeekMeals = meals.filter(
    (m) => m.date >= nextStart && m.date <= nextEnd,
  );

  const thisItems = aggregate(thisWeekMeals, Number(thisStart.slice(5, 7)));
  const nextItems = aggregate(nextWeekMeals, Number(nextStart.slice(5, 7)));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight md:text-3xl">
          Liste de courses
        </h1>
        <p className="mt-1 text-muted-foreground">
          Les ingrédients des repas planifiés, semaine par semaine.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">
          Repas planifiés cette semaine
        </h2>
        {thisItems.length ? (
          <ShoppingList
            items={thisItems}
            weekStart={thisStart}
            initialChecked={thisChecks}
          />
        ) : (
          <EmptyState />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold">
          Repas planifiés la semaine prochaine
        </h2>
        {nextItems.length ? (
          <ShoppingList
            items={nextItems}
            weekStart={nextStart}
            initialChecked={nextChecks}
          />
        ) : (
          <EmptyState />
        )}
      </section>
    </div>
  );
}
