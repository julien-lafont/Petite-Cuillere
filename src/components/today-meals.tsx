"use client";

import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { MealCard } from "@/components/meal-card";
import { MealQuickRating } from "@/components/meal-quick-rating";
import { MealEvaluateDialog } from "@/components/meal-evaluate-dialog";
import {
  indexMeals,
  mealKey,
  type MealWithDetails,
} from "@/lib/data/meals.types";
import type { MealMoment } from "@/lib/data/meal-moments";

export function TodayMeals({
  babyId,
  date,
  dateLabel,
  moments,
  meals,
  ageMonths,
  introducedIds,
  upcomingCounts,
}: {
  babyId: string;
  date: string;
  dateLabel: string;
  moments: MealMoment[];
  meals: MealWithDetails[];
  ageMonths: number;
  introducedIds?: string[];
  upcomingCounts?: Record<string, number>;
}) {
  const [openMomentId, setOpenMomentId] = useState<string | null>(null);
  const index = indexMeals(meals);
  const introducedSet = introducedIds ? new Set(introducedIds) : null;

  const visible = moments.filter(
    (m) => (index.get(mealKey(date, m.id))?.meal_items.length ?? 0) > 0,
  );

  const openMoment = moments.find((m) => m.id === openMomentId) ?? null;
  const openMeal = openMomentId
    ? (index.get(mealKey(date, openMomentId)) ?? null)
    : null;

  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-5 text-center text-muted-foreground">
        Rien de prévu aujourd'hui. Composez la semaine depuis l'onglet{" "}
        <span className="font-medium text-foreground">Ma semaine</span>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {visible.map((moment) => {
        const meal = index.get(mealKey(date, moment.id))!;

        // Bandeau d'introduction d'allergène : le seul cas où l'écran change de
        // registre (cf. docs/ux-redesign.md §5).
        const newAllergen = meal.meal_items
          .map((it) => it.food)
          .find(
            (f) =>
              f?.is_allergen && (!introducedSet || !introducedSet.has(f.id)),
          );

        return (
          <section key={moment.id} className="space-y-3">
            {newAllergen && (
              <div className="flex items-start gap-2.5 rounded-md border border-novelty/30 bg-novelty-soft px-4 py-3 text-sm text-novelty-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-novelty" />
                <p className="text-foreground/85">
                  Aujourd'hui, première fois avec{" "}
                  <span className="font-semibold">
                    {newAllergen.name.toLowerCase()}
                  </span>
                  . Proposez-le plutôt le matin ou le midi et restez attentif
                  dans les heures qui suivent.
                </p>
              </div>
            )}

            <MealCard
              momentLabel={moment.label}
              meal={meal}
              ageMonths={ageMonths}
              introducedIds={introducedIds}
              upcomingCounts={upcomingCounts}
            />

            <div className="rounded-lg border bg-card px-4 py-4 shadow-soft">
              <MealQuickRating
                babyId={babyId}
                date={date}
                momentId={moment.id}
                current={meal.result}
              />
              <button
                type="button"
                onClick={() => setOpenMomentId(moment.id)}
                className="mx-auto mt-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <Plus className="size-4" />
                Ajouter une note ou un effet
              </button>
            </div>
          </section>
        );
      })}

      {openMoment && (
        <MealEvaluateDialog
          open={!!openMomentId}
          onOpenChange={(v) => !v && setOpenMomentId(null)}
          babyId={babyId}
          date={date}
          momentId={openMoment.id}
          momentLabel={openMoment.label}
          dateLabel={dateLabel}
          meal={openMeal}
        />
      )}
    </div>
  );
}
