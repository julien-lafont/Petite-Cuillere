import { ShoppingBasket } from "lucide-react";
import { getActiveBaby } from "@/lib/data/baby";
import { getMealsBetween, type MealWithDetails } from "@/lib/data/meals";
import { getShoppingChecks } from "@/lib/data/shopping";
import { getAgeInfo } from "@/lib/age";
import { weekDays, addDays, toISODate } from "@/lib/dates";
import { freshnessAdvice } from "@/lib/season";
import { portionFor } from "@/lib/portions";
import { ShoppingList, type ShoppingItem } from "@/components/shopping-list";
import { ScopeSwitch } from "@/components/scope-switch";

/**
 * Agrège les ingrédients d'un ensemble de repas, avec quantité cumulée (grammes)
 * et nombre de repas — de quoi produire une quantité d'achat concrète.
 */
function aggregate(
  meals: MealWithDetails[],
  month: number,
  ageMonths: number,
): ShoppingItem[] {
  const map = new Map<string, ShoppingItem>();
  for (const meal of meals) {
    for (const item of meal.meal_items) {
      const f = item.food;
      if (!f) continue;
      const portion = portionFor(f.category, ageMonths);
      const existing = map.get(f.id);
      if (existing) {
        existing.count += 1;
        if (portion.grams !== null)
          existing.grams = (existing.grams ?? 0) + portion.grams;
      } else {
        map.set(f.id, {
          id: f.id,
          name: f.name,
          category: f.category,
          count: 1,
          grams: portion.grams,
          advice: freshnessAdvice(f.season, month),
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
    <div className="rounded-lg border border-dashed p-6 text-center">
      <ShoppingBasket className="mx-auto size-7 text-muted-foreground" />
      <p className="mt-2 text-muted-foreground">
        Rien à acheter sur cette période — le programme n&apos;a pas encore de
        repas ici.
      </p>
    </div>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ portee?: string }>;
}) {
  const baby = await getActiveBaby();
  if (!baby) return null;

  const { portee } = await searchParams;
  const scope = portee === "mois" ? "mois" : "semaine";

  const age = getAgeInfo(
    new Date(baby.date_naissance),
    baby.date_terme ? new Date(baby.date_terme) : null,
    baby.age_reference_date ? new Date(baby.age_reference_date) : null,
  );

  const monday = weekDays(new Date())[0];
  const startISO = toISODate(monday);
  // Semaine = 7 jours ; mois = 4 semaines glissantes.
  const endISO = toISODate(addDays(monday, scope === "mois" ? 27 : 6));

  const [meals, checks] = await Promise.all([
    getMealsBetween(baby.id, startISO, endISO),
    getShoppingChecks(startISO),
  ]);

  const items = aggregate(
    meals,
    Number(startISO.slice(5, 7)),
    age.effectiveMonths,
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Ma liste de courses
        </h1>
        <p className="mt-1 text-muted-foreground">
          Tout ce qu&apos;il faut acheter, avec les quantités déjà calculées
          pour {baby.prenom}.
        </p>
      </header>

      <ScopeSwitch scope={scope} />

      {items.length ? (
        <ShoppingList
          items={items}
          weekStart={startISO}
          initialChecked={checks}
        />
      ) : (
        <EmptyState />
      )}

      <p className="text-center text-xs text-muted-foreground">
        Quantités indicatives — à ajuster selon l&apos;appétit de {baby.prenom}.
      </p>
    </div>
  );
}
