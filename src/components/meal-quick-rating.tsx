"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { setMealResult } from "@/lib/data/meals.actions";
import type { MealResult } from "@/lib/data/meals.types";

/**
 * Notation d'un repas en un seul geste : trois grandes cibles, aucune modale,
 * aucun champ obligatoire (cf. docs/ux-redesign.md §5). Optimiste : la sélection
 * s'affiche immédiatement, la sauvegarde suit en arrière-plan.
 *
 * Volontairement dénué de toute notion de série, de score ou de complétion — un
 * repas non noté reste simplement non noté (décision de cadrage D8).
 */
// Couleur par résultat, alignée sur `meal-evaluation-fields` : vert (aimé) /
// ambre (moyen) / rouge (refusé). Le survol teinte déjà de la bonne couleur pour
// annoncer ce qu'on s'apprête à choisir.
const OPTIONS: {
  value: Exclude<MealResult, null>;
  emoji: string;
  label: string;
  activeCls: string;
  hoverCls: string;
}[] = [
  {
    value: "bien",
    emoji: "😋",
    label: "adoré",
    activeCls: "border-primary bg-primary/12 text-primary",
    hoverCls: "hover:bg-primary/10 hover:text-primary",
  },
  {
    value: "moyen",
    emoji: "😐",
    label: "moyen",
    activeCls: "border-chart-3 bg-chart-3/20 text-amber-700",
    hoverCls: "hover:bg-chart-3/15 hover:text-amber-700",
  },
  {
    value: "refuse",
    emoji: "🙅",
    label: "refusé",
    activeCls: "border-destructive bg-destructive/10 text-destructive",
    hoverCls: "hover:bg-destructive/10 hover:text-destructive",
  },
];

export function MealQuickRating({
  babyId,
  date,
  momentId,
  current,
}: {
  babyId: string;
  date: string;
  momentId: string;
  current: MealResult;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState<MealResult>(current);

  function choose(next: Exclude<MealResult, null>) {
    const resolved = value === next ? null : next; // retaper = désélectionner
    setValue(resolved);
    startTransition(async () => {
      await setMealResult(babyId, date, momentId, resolved);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2.5">
      <p className="text-center text-sm font-medium text-muted-foreground">
        Comment ça s'est passé ?
      </p>
      <div className="grid grid-cols-3 gap-2.5">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => choose(opt.value)}
              className={cn(
                "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-md border-2 text-sm font-semibold transition-all active:translate-y-px",
                active
                  ? opt.activeCls
                  : cn(
                      "border-transparent bg-muted text-muted-foreground",
                      opt.hoverCls,
                    ),
              )}
            >
              <span className="text-2xl leading-none">{opt.emoji}</span>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
