"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MealCard } from "@/components/meal-card";
import { MealEvaluateDialog } from "@/components/meal-evaluate-dialog";
import { indexMeals, mealKey, type MealWithDetails } from "@/lib/data/meals.types";
import type { MealMoment } from "@/lib/data/meal-moments";

export function TodayMeals({
  babyId,
  date,
  dateLabel,
  moments,
  meals,
  scores,
  introducedIds,
}: {
  babyId: string;
  date: string;
  dateLabel: string;
  moments: MealMoment[];
  meals: MealWithDetails[];
  scores?: Record<string, number>;
  introducedIds?: string[];
}) {
  const [openMomentId, setOpenMomentId] = useState<string | null>(null);
  const index = indexMeals(meals);

  const visible = moments.filter(
    (m) => (index.get(mealKey(date, m.id))?.meal_items.length ?? 0) > 0,
  );

  const openMoment = moments.find((m) => m.id === openMomentId) ?? null;
  const openMeal = openMomentId
    ? (index.get(mealKey(date, openMomentId)) ?? null)
    : null;

  if (visible.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Aucun repas prévu aujourd&apos;hui — planifie-les sur l&apos;onglet Semaine.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {visible.map((moment) => {
        const meal = index.get(mealKey(date, moment.id))!;
        return (
          <div key={moment.id} className="space-y-2">
            <MealCard
              momentLabel={moment.label}
              meal={meal}
              scores={scores}
              introducedIds={introducedIds}
            />
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setOpenMomentId(moment.id)}
            >
              <ClipboardCheck className="size-4" />
              Évaluer le repas
            </Button>
          </div>
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
