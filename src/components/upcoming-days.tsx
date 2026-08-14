"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MealCard } from "@/components/meal-card";
import {
  indexMeals,
  mealKey,
  type MealWithDetails,
} from "@/lib/data/meals.types";
import type { MealMoment } from "@/lib/data/meal-moments";

/** A food as it appears on a day's collapsed row. */
type Chip = { id: string; name: string; firstAllergen: boolean };

/**
 * The next seven days, collapsed. Each day's menu reads as chips rather than a
 * sentence ("Déjeuner : épinard, petit-suisse"): you scan the column to do your
 * shopping, you do not read seven sentences.
 *
 * ── First allergen introduction ────────────────────────────────────────────
 * The chip turns amber on the **first** day an unknown allergen appears, and
 * goes back to neutral on later days: that is the day to be at home, available,
 * and watching the two hours that follow. Flagging it four days running would
 * amount to flagging nothing.
 */
function chipsFor(meals: MealWithDetails[], seen: Set<string>): Chip[] {
  const chips: Chip[] = [];

  for (const meal of meals) {
    for (const item of meal.meal_items) {
      const food = item.food;
      if (!food || chips.some((c) => c.id === food.id)) continue;
      const firstAllergen = food.is_allergen && !seen.has(food.id);
      // Once seen, the food is no longer flagged: the discovery has happened.
      seen.add(food.id);
      chips.push({ id: food.id, name: food.name, firstAllergen });
    }
  }

  return chips;
}

export function UpcomingDays({
  moments,
  days,
  meals,
  ageMonths,
  introducedIds,
}: {
  moments: MealMoment[];
  days: { dateISO: string; dateLabel: string }[];
  meals: MealWithDetails[];
  ageMonths: number;
  introducedIds?: string[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const index = indexMeals(meals);

  function toggle(dateISO: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(dateISO)) next.delete(dateISO);
      else next.add(dateISO);
      return next;
    });
  }

  // The discovery thread runs from one day to the next: it starts from what the
  // child already knows, and grows as the days are walked through.
  const seen = new Set(introducedIds ?? []);

  const rows = days.map(({ dateISO, dateLabel }) => {
    const dayMoments = moments.filter(
      (m) => (index.get(mealKey(dateISO, m.id))?.meal_items.length ?? 0) > 0,
    );
    const chips = chipsFor(
      dayMoments.map((m) => index.get(mealKey(dateISO, m.id))!),
      seen,
    );
    return { dateISO, dateLabel, dayMoments, chips };
  });

  // The legend only makes sense if there is actually an amber chip to explain.
  const hasFirstAllergen = rows.some((r) =>
    r.chips.some((c) => c.firstAllergen),
  );

  return (
    <div className="space-y-2.5">
      {rows.map(({ dateISO, dateLabel, dayMoments, chips }) => {
        const isOpen = expanded.has(dateISO);

        return (
          <div
            key={dateISO}
            className="overflow-hidden rounded-lg border bg-card"
          >
            <button
              onClick={() => toggle(dateISO)}
              className="flex min-h-[3.5rem] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-muted/40"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3.5">
                <span className="font-heading font-semibold capitalize sm:w-[9rem] sm:shrink-0">
                  {dateLabel}
                </span>
                {chips.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {chips.map((chip) => (
                      <FoodChip key={chip.id} allergen={chip.firstAllergen}>
                        {chip.name}
                      </FoodChip>
                    ))}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Aucun repas prévu
                  </span>
                )}
              </span>
              {dayMoments.length > 0 && (
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              )}
            </button>

            {isOpen && dayMoments.length > 0 && (
              <div className="space-y-3 border-t p-3.5">
                {dayMoments.map((m) => (
                  <MealCard
                    key={m.id}
                    momentLabel={m.label}
                    meal={index.get(mealKey(dateISO, m.id))!}
                    ageMonths={ageMonths}
                    introducedIds={introducedIds}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {hasFirstAllergen && (
        <p className="flex flex-wrap items-center gap-2 pt-1 text-sm text-muted-foreground">
          <FoodChip allergen>allergène</FoodChip>
          première introduction prévue ce jour-là
        </p>
      )}
    </div>
  );
}

/** A food on the menu, as a chip. Amber when it is a first time. */
function FoodChip({
  allergen,
  children,
}: {
  allergen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        allergen
          ? "bg-novelty-soft text-novelty ring-1 ring-inset ring-novelty/25"
          : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
