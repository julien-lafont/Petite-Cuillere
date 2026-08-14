"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MealEvaluationFields,
  type LocalObs,
} from "@/components/meal-evaluation-fields";
import type { MealWithDetails, MealResult } from "@/lib/data/meals.types";
import { saveMeal } from "@/lib/data/meals.actions";

export function MealEvaluateDialog({
  open,
  onOpenChange,
  babyId,
  date,
  momentId,
  momentLabel,
  dateLabel,
  meal,
  onEditFoods,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  babyId: string;
  date: string;
  momentId: string;
  momentLabel: string;
  dateLabel: string;
  meal: MealWithDetails | null;
  onEditFoods?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MealResult>(null);
  const [note, setNote] = useState("");
  const [observations, setObservations] = useState<LocalObs[]>([]);

  /*
   * The form restarts from the saved meal on every open — and only then: while
   * the parent is typing, a server refresh must not overwrite what they are
   * writing.
   *
   * The adjustment happens during render rather than in an effect. React then
   * abandons the render in progress and restarts it with the right values,
   * without ever painting the stale state; an effect runs after the paint — the
   * dialogue opened on one frame of the previous meal's values.
   */
  const session = open ? `${date}|${momentId}` : null;
  const [loaded, setLoaded] = useState<string | null>(null);
  if (session !== loaded) {
    setLoaded(session);
    if (session !== null) {
      setResult(meal?.result ?? null);
      setNote(meal?.note ?? "");
      setObservations(
        (meal?.intake_observations ?? []).map((o) => ({
          key: o.id,
          effect_type: o.effect_type ?? "",
          severity: o.severity ?? "léger",
        })),
      );
    }
  }

  function save() {
    startTransition(async () => {
      await saveMeal(babyId, date, momentId, {
        result,
        note,
        intent: "evaluate",
        // foods/allergens kept as they are
        foodIds: (meal?.meal_items ?? [])
          .map((i) => i.food?.id)
          .filter((x): x is string => !!x),
        allergenIds: (meal?.meal_allergens ?? [])
          .map((a) => a.allergen?.id)
          .filter((x): x is string => !!x),
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
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Évaluer — {momentLabel}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {dateLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto">
          <MealEvaluationFields
            result={result}
            setResult={setResult}
            note={note}
            setNote={setNote}
            observations={observations}
            setObservations={setObservations}
          />

          {onEditFoods && (
            <button
              onClick={onEditFoods}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <Pencil className="size-3.5" />
              Modifier les aliments du repas
            </button>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Enregistrer l'évaluation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
