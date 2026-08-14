"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MealFoodPicker } from "@/components/meal-food-picker";
import { MealNoFoodsMessage } from "@/components/meal-no-foods-message";
import type {
  MealWithDetails,
  IntroductionCounts,
} from "@/lib/data/meals.types";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";
import { saveMeal } from "@/lib/data/meals.actions";
import { ageMonthsAtDate, hasEligibleFoods } from "@/lib/food-eligibility";
import {
  mealAllergenIds,
  mealFoodIds,
  selectionSignature,
} from "@/lib/meal-selection";

export function MealPlanDialog({
  open,
  onOpenChange,
  babyId,
  date,
  momentId,
  momentLabel,
  dateLabel,
  meal,
  foods,
  allergens,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  babyId: string;
  date: string;
  momentId: string;
  momentLabel: string;
  dateLabel: string;
  meal: MealWithDetails | null;
  foods: FoodRow[];
  allergens: AllergenRow[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [foodIds, setFoodIds] = useState<Set<string>>(new Set());
  const [allergenIds, setAllergenIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [showCounts, setShowCounts] = useState(false);
  const [counts, setCounts] = useState<IntroductionCounts | null>(null);

  /*
   * The form restarts from the saved meal on every open — and only then: while
   * the parent is typing, a server refresh must not overwrite the selection in
   * progress.
   *
   * The adjustment happens during render rather than in an effect. React then
   * abandons the render in progress and restarts it with the right values,
   * without ever painting the stale state; an effect runs after the paint — the
   * dialogue opened on one frame of the previous meal's foods.
   */
  const session = open ? `${date}|${momentId}` : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  if (session !== loaded) {
    setLoaded(session);
    if (session !== null) {
      setFoodIds(mealFoodIds(meal));
      setAllergenIds(mealAllergenIds(meal));
    }
  }

  /*
   * Nothing to save while the selection is the original one. The reference is
   * recomputed from `meal` on every render rather than memoised on open: it is
   * the same value, without the parallel state to keep in sync.
   */
  const dirty =
    selectionSignature(foodIds, allergenIds) !==
    selectionSignature(mealFoodIds(meal), mealAllergenIds(meal));

  const ageMonths = ageMonthsAtDate(date, birthDate, dueDate, ageReferenceDate);
  const canPickFoods = hasEligibleFoods(foods, ageMonths);

  function save() {
    startTransition(async () => {
      await saveMeal(babyId, date, momentId, {
        result: meal?.result ?? null,
        note: meal?.note ?? "",
        intent: "plan",
        foodIds: [...foodIds],
        allergenIds: [...allergenIds],
        observations: (meal?.intake_observations ?? []).map((o) => ({
          effect_type: o.effect_type ?? "",
          severity: o.severity ?? "léger",
          note: o.note ?? "",
        })),
      });
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {momentLabel}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {dateLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto">
          {canPickFoods ? (
            <MealFoodPicker
              babyId={babyId}
              date={date}
              foods={foods}
              allergens={allergens}
              birthDate={birthDate}
              dueDate={dueDate}
              ageReferenceDate={ageReferenceDate}
              foodIds={foodIds}
              setFoodIds={setFoodIds}
              allergenIds={allergenIds}
              setAllergenIds={setAllergenIds}
              showAll={showAll}
              setShowAll={setShowAll}
              showCounts={showCounts}
              setShowCounts={setShowCounts}
              counts={counts}
              setCounts={setCounts}
            />
          ) : (
            <MealNoFoodsMessage />
          )}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          {canPickFoods ? (
            <>
              <span className="text-xs text-muted-foreground">
                {foodIds.size} aliment{foodIds.size > 1 ? "s" : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={isPending}
                >
                  Annuler
                </Button>
                <Button onClick={save} disabled={isPending || !dirty}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="ghost"
              className="ml-auto"
              onClick={() => onOpenChange(false)}
            >
              Fermer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
