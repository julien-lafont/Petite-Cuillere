"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MealCard } from "@/components/meal-card";
import { indexMeals, mealKey, type MealWithDetails } from "@/lib/data/meals.types";
import type { MealMoment } from "@/lib/data/meal-moments";

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

  return (
    <div className="space-y-2.5">
      {days.map(({ dateISO, dateLabel }) => {
        const dayMoments = moments.filter(
          (m) => (index.get(mealKey(dateISO, m.id))?.meal_items.length ?? 0) > 0,
        );
        const isOpen = expanded.has(dateISO);
        const summary = dayMoments
          .map((m) => {
            const meal = index.get(mealKey(dateISO, m.id))!;
            const foods = meal.meal_items
              .map((i) => i.food?.name)
              .filter(Boolean)
              .join(", ");
            return `${m.label} : ${foods}`;
          })
          .join(" · ");

        return (
          <div key={dateISO} className="overflow-hidden rounded-lg border bg-card">
            <button
              onClick={() => toggle(dateISO)}
              className="flex min-h-[3.5rem] w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="font-heading font-semibold capitalize">{dateLabel}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {dayMoments.length ? summary : "Aucun repas prévu"}
                </p>
              </div>
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
    </div>
  );
}
