"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { Separator } from "@/components/ui/separator";
import { MealFoodPicker } from "@/components/meal-food-picker";
import {
  MealEvaluationFields,
  type LocalObs,
} from "@/components/meal-evaluation-fields";
import { MealNoFoodsMessage } from "@/components/meal-no-foods-message";
import type {
  MealWithDetails,
  MealResult,
  IntroductionCounts,
} from "@/lib/data/meals.types";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";
import { saveMeal } from "@/lib/data/meals.actions";
import { ageMonthsAtDate, hasEligibleFoods } from "@/lib/food-eligibility";

/**
 * Formulaire combiné (repas passé/aujourd'hui encore vide) : configuration
 * des aliments/allergènes ET évaluation en une seule saisie.
 */
export function MealLogDialog({
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

  const [result, setResult] = useState<MealResult>(null);
  const [note, setNote] = useState("");
  const [observations, setObservations] = useState<LocalObs[]>([]);
  const initialRef = useRef("");

  useEffect(() => {
    if (!open) return;
    const f = new Set(
      (meal?.meal_items ?? [])
        .map((i) => i.food?.id)
        .filter((x): x is string => !!x),
    );
    const a = new Set(
      (meal?.meal_allergens ?? [])
        .map((x) => x.allergen?.id)
        .filter((x): x is string => !!x),
    );
    setFoodIds(f);
    setAllergenIds(a);
    setResult(meal?.result ?? null);
    setNote(meal?.note ?? "");
    setObservations(
      (meal?.intake_observations ?? []).map((o) => ({
        key: o.id,
        effect_type: o.effect_type ?? "",
        severity: o.severity ?? "léger",
      })),
    );
    initialRef.current = JSON.stringify([[...f].sort(), [...a].sort()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, momentId]);

  const ageMonths = ageMonthsAtDate(date, birthDate, dueDate, ageReferenceDate);
  const canPickFoods = hasEligibleFoods(foods, ageMonths);

  function save() {
    startTransition(async () => {
      await saveMeal(babyId, date, momentId, {
        result,
        note,
        foodIds: [...foodIds],
        allergenIds: [...allergenIds],
        observations: observations.map((o) => ({
          effect_type: o.effect_type,
          severity: o.severity,
          note: "",
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
            <>
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

              <Separator />

              <MealEvaluationFields
                result={result}
                setResult={setResult}
                note={note}
                setNote={setNote}
                observations={observations}
                setObservations={setObservations}
              />
            </>
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
                <Button onClick={save} disabled={isPending}>
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Enregistrer le repas
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
