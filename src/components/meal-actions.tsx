"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { setMealServed, setMealSkipped } from "@/lib/data/meal-reality.actions";
import type { MealStatus } from "@/lib/data/meals.types";

/**
 * La barre d'action d'un repas — trois cibles, une seule question.
 *
 * Ce qui manquait d'abord, ce n'était pas « comment ça s'est passé ? » mais
 * « est-ce que ce repas a eu lieu ? » : la première question présuppose la
 * réponse à la seconde. Le pied de fiche demandait donc une appréciation pour
 * clore un repas, et il fallait juger l'enfant pour renseigner l'app.
 *
 * Les trois issues réelles d'un repas sont ici côte à côte, chacune nommée par
 * ce qu'elle fait :
 *
 *   ✓ Ce repas est fait        → servi
 *     Repas sauté              → sauté
 *     Le menu a changé         → remplacé (ouvre la feuille de composition)
 *
 * Elles remplacent les cinq tuiles précédentes (trois émojis, deux pointillés)
 * et le lien souligné qui les suivait. L'ancien libellé « Il a mangé autre
 * chose » décrivait une situation ; « Le menu a changé » nomme le geste, et
 * n'a pas de genre à accorder.
 *
 * La hiérarchie tient par le remplissage, pas par la taille : une pilule
 * pleine pour le chemin courant, deux pilules à contour pour les divergences.
 * Toutes trois ont la même forme — c'est ce qui manquait le plus, une famille
 * graphique unique là où il y en avait cinq.
 *
 * L'appréciation ne vit plus ici : elle est proposée après coup, sur la ligne
 * résumée du repas clos (`MealSummaryRow`), et reste facultative — un repas
 * non noté reste simplement non noté (décision de cadrage D8).
 *
 * Optimiste : l'état s'affiche immédiatement, l'écriture suit. Retaper l'état
 * actif l'annule, comme partout ailleurs — il n'y a pas de bouton « annuler »
 * séparé à chercher.
 */
export function MealActions({
  babyId,
  date,
  momentId,
  status,
  onMenuChanged,
  onSettled,
}: {
  babyId: string;
  date: string;
  momentId: string;
  status: MealStatus;
  /** Ouvre la feuille « le menu a changé ». */
  onMenuChanged: () => void;
  /** Le repas vient d'être renseigné — le fil peut avancer. */
  onSettled?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [state, setState] = useState<MealStatus>(status);
  const [message, setMessage] = useState<string | null>(null);

  const served = state === "servi" || state === "remplace";
  const skipped = state === "saute";

  function toggleServed() {
    const next = !served;
    setState(next ? "servi" : "prevu");
    setMessage(null);
    startTransition(async () => {
      await setMealServed(babyId, date, momentId, next);
      router.refresh();
      if (next) onSettled?.();
    });
  }

  function toggleSkipped() {
    const next = !skipped;
    setState(next ? "saute" : "prevu");
    setMessage(null);
    startTransition(async () => {
      const res = await setMealSkipped(babyId, date, momentId, next);
      router.refresh();
      if (next) {
        setMessage(res.sentence);
        onSettled?.();
      }
    });
  }

  return (
    <div className="space-y-2.5">
      <button
        type="button"
        aria-pressed={served}
        onClick={toggleServed}
        className={cn(
          "flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] text-base font-semibold transition-colors",
          served
            ? "border-primary bg-secondary text-secondary-foreground"
            : "border-primary bg-primary text-primary-foreground",
        )}
      >
        <Check className="size-5 shrink-0" />
        {served ? "Repas fait — annuler" : "Ce repas est fait"}
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          aria-pressed={skipped}
          onClick={toggleSkipped}
          className={cn(
            "flex min-h-11 items-center justify-center rounded-full border-[1.5px] px-3 text-center text-sm font-semibold leading-tight transition-colors",
            skipped
              ? "border-foreground/30 bg-muted text-foreground"
              : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
          )}
        >
          {skipped ? "Repas sauté — annuler" : "Repas sauté"}
        </button>
        <button
          type="button"
          aria-pressed={state === "remplace"}
          onClick={onMenuChanged}
          className={cn(
            "flex min-h-11 items-center justify-center rounded-full border-[1.5px] px-3 text-center text-sm font-semibold leading-tight transition-colors",
            state === "remplace"
              ? "border-novelty/50 bg-novelty-soft text-foreground"
              : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
          )}
        >
          Le menu a changé
        </button>
      </div>

      {message && (
        <p className="rounded-md bg-accent px-3.5 py-2.5 text-sm text-accent-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
