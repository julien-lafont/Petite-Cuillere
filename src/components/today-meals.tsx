"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { MealCard } from "@/components/meal-card";
import { MealQuickRating } from "@/components/meal-quick-rating";
import { MealEvaluateDialog } from "@/components/meal-evaluate-dialog";
import { MealRealitySheet } from "@/components/meal-reality-sheet";
import { AllergenExposureBanner } from "@/components/allergen-exposure-banner";
import {
  indexMeals,
  mealKey,
  type MealWithDetails,
} from "@/lib/data/meals.types";
import type { MealMoment } from "@/lib/data/meal-moments";
import type { FoodRow } from "@/lib/data/foods";

export function TodayMeals({
  babyId,
  date,
  dateLabel,
  moments,
  meals,
  ageMonths,
  introducedIds,
  upcomingCounts,
  foods,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  babyId: string;
  date: string;
  dateLabel: string;
  moments: MealMoment[];
  meals: MealWithDetails[];
  ageMonths: number;
  introducedIds?: string[];
  upcomingCounts?: Record<string, number>;
  /** Catalogue, pour la feuille « il a mangé autre chose ». */
  foods: FoodRow[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
}) {
  const [openMomentId, setOpenMomentId] = useState<string | null>(null);
  const [realityMomentId, setRealityMomentId] = useState<string | null>(null);
  const index = indexMeals(meals);
  const introducedSet = introducedIds ? new Set(introducedIds) : null;

  const visible = moments.filter(
    (m) => (index.get(mealKey(date, m.id))?.meal_items.length ?? 0) > 0,
  );

  const openMoment = moments.find((m) => m.id === openMomentId) ?? null;
  const openMeal = openMomentId
    ? (index.get(mealKey(date, openMomentId)) ?? null)
    : null;
  const realityMoment = moments.find((m) => m.id === realityMomentId) ?? null;
  const realityMeal = realityMomentId
    ? (index.get(mealKey(date, realityMomentId)) ?? null)
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
        // registre (cf. docs/ux-redesign.md §5), et le seul endroit où l'app
        // demande une confirmation explicite (docs/feats/suivi-reel §3).
        const allergenItem = meal.meal_items.find(
          (it) =>
            it.food?.is_allergen &&
            (!introducedSet || !introducedSet.has(it.food.id)),
        );

        // Découverte du jour : sert le message qui suit un refus (« il faut
        // souvent huit à dix essais »).
        const novelty = introducedSet
          ? meal.meal_items
              .map((it) => it.food)
              .find((f) => f && !introducedSet.has(f.id))
          : null;

        return (
          <section key={moment.id} className="space-y-3">
            {allergenItem?.food && (
              <AllergenExposureBanner
                babyId={babyId}
                allergenName={
                  allergenItem.food.allergen_type ?? allergenItem.food.name
                }
                foodName={allergenItem.food.name}
                mealItemId={allergenItem.id}
                skipped={allergenItem.skipped}
                askConfirmation={
                  meal.status === "servi" ||
                  meal.status === "remplace" ||
                  !!meal.result
                }
              />
            )}

            {/* Une seule carte : le repas et son compte rendu parlent de la
                même chose (cf. `MealCard`, prop `footer`). */}
            <MealCard
              momentLabel={moment.label}
              meal={meal}
              ageMonths={ageMonths}
              introducedIds={introducedIds}
              upcomingCounts={upcomingCounts}
              substitution={{ babyId, foods }}
              footer={
                <>
                  <MealQuickRating
                    babyId={babyId}
                    date={date}
                    momentId={moment.id}
                    current={meal.result}
                    status={meal.status}
                    noveltyName={novelty?.name ?? null}
                    onOther={() => setRealityMomentId(moment.id)}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenMomentId(moment.id)}
                    className="mx-auto mt-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    <Plus className="size-4" />
                    Ajouter une note ou un effet
                  </button>
                </>
              }
            />
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

      {realityMoment && (
        <MealRealitySheet
          key={`${date}|${realityMoment.id}`}
          open={!!realityMomentId}
          onOpenChange={(v) => !v && setRealityMomentId(null)}
          babyId={babyId}
          date={date}
          momentId={realityMoment.id}
          momentLabel={realityMoment.label}
          dateLabel={dateLabel}
          meal={realityMeal}
          foods={foods}
          introducedIds={introducedIds ?? []}
          birthDate={birthDate}
          dueDate={dueDate}
          ageReferenceDate={ageReferenceDate}
        />
      )}
    </div>
  );
}
