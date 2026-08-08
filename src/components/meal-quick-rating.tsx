"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { setMealResult } from "@/lib/data/meals.actions";
import { setMealSkipped } from "@/lib/data/meal-reality.actions";
import { refusalReassurance } from "@/lib/program/diff";
import type { MealResult, MealStatus } from "@/lib/data/meals.types";

/**
 * Le compte rendu d'un repas, en un seul geste : cinq cibles, aucune modale,
 * aucun champ obligatoire (cf. docs/ux-redesign.md §5). Optimiste : la sélection
 * s'affiche immédiatement, la sauvegarde suit en arrière-plan.
 *
 * Deux questions, deux rangées — la seconde répond à ce que la première ne sait
 * pas dire :
 *
 *   😋 😐 🙅              comment ça s'est passé
 *   ⇄ autre chose  ⊘ pas donné   ce n'était pas le repas prévu
 *
 * Les deux divergences étaient auparavant des liens soulignés en typographie
 * secondaire (docs/feats/suivi-reel §4.1). Elles se lisaient comme des notes de
 * bas de page, là où elles décrivent des situations aussi banales que les trois
 * autres — un repas chez la nounou, un frigo vide. Elles prennent donc la même
 * forme de tuile, en second rang : plus petites, contour en pointillés, sous les
 * cibles principales qui restent les plus grandes.
 *
 * « Pas donné » est un état : la tuile reste enfoncée, et un second tap annule —
 * il n'y a pas de bouton « Annuler » séparé à chercher.
 *
 * Volontairement dénué de toute notion de série, de score ou de complétion — un
 * repas non noté reste simplement non noté (décision de cadrage D8).
 */
// Couleur par résultat, alignée sur `meal-evaluation-fields` : vert (aimé) /
// ambre (moyen) / rouge (refusé). Le survol teinte déjà de la bonne couleur pour
// annoncer ce qu'on s'apprête à choisir.
//
// Au repos, les trois tuiles sont posées sur le fond de la carte avec un simple
// filet — pas un aplat gris. Un bloc de trois pavés gris se lisait comme une
// zone désactivée, alors que c'est le seul geste que l'écran demande.
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
    label: "Adoré",
    activeCls: "border-primary bg-secondary text-secondary-foreground",
    hoverCls: "hover:border-primary hover:text-primary",
  },
  {
    value: "moyen",
    emoji: "😐",
    label: "Moyen",
    activeCls: "border-chart-3 bg-chart-3/20 text-amber-700",
    hoverCls: "hover:border-chart-3 hover:text-amber-700",
  },
  {
    value: "refuse",
    emoji: "🙅",
    label: "Refusé",
    activeCls: "border-destructive bg-destructive/10 text-destructive",
    hoverCls: "hover:border-destructive hover:text-destructive",
  },
];

export function MealQuickRating({
  babyId,
  date,
  momentId,
  current,
  status = "prevu",
  /** Nom de la découverte du jour — sert le message qui suit un refus. */
  noveltyName = null,
  onOther,
}: {
  babyId: string;
  date: string;
  momentId: string;
  current: MealResult;
  status?: MealStatus;
  noveltyName?: string | null;
  /** Ouvre la feuille « il a mangé autre chose ». */
  onOther?: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState<MealResult>(current);
  const [skipped, setSkipped] = useState(status === "saute");
  const [message, setMessage] = useState<string | null>(null);

  const replaced = status === "remplace";

  function choose(next: Exclude<MealResult, null>) {
    const resolved = value === next ? null : next; // retaper = désélectionner
    setValue(resolved);
    setSkipped(false);
    // Un refus ne décale rien (décision G) : il n'y a rien à replanifier, mais
    // c'est ici que le parent doute — et l'app se taisait.
    setMessage(resolved === "refuse" ? refusalReassurance(noveltyName) : null);
    startTransition(async () => {
      await setMealResult(babyId, date, momentId, resolved);
      router.refresh();
    });
  }

  function toggleSkip() {
    const next = !skipped;
    setSkipped(next);
    if (next) setValue(null);
    setMessage(null);
    startTransition(async () => {
      const res = await setMealSkipped(babyId, date, momentId, next);
      router.refresh();
      if (next) setMessage(res.sentence);
    });
  }

  return (
    <div className="space-y-2.5">
      <p className="font-heading font-semibold">Comment ça s'est passé ?</p>

      <div className="grid grid-cols-3 gap-2.5">
        {OPTIONS.map((opt) => {
          const active = !skipped && value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={active}
              onClick={() => choose(opt.value)}
              className={cn(
                "flex min-h-[4.5rem] flex-col items-center justify-center gap-1 rounded-md border-[1.5px] bg-card text-sm font-semibold transition-all active:translate-y-px",
                active
                  ? opt.activeCls
                  : cn("border-border text-muted-foreground", opt.hoverCls),
              )}
            >
              <span className="text-2xl leading-none">{opt.emoji}</span>
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Second rang : ce n'était pas le repas prévu. Même famille visuelle,
          hiérarchie tenue par la taille et le contour en pointillés. */}
      <div className="grid grid-cols-2 gap-2.5">
        {onOther && (
          <button
            type="button"
            aria-pressed={replaced}
            onClick={onOther}
            className={cn(
              "flex min-h-14 items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed px-2 text-center text-sm font-medium leading-tight transition-all active:translate-y-px",
              replaced
                ? "border-solid border-novelty/50 bg-novelty-soft text-foreground"
                : "border-border bg-transparent text-muted-foreground hover:border-foreground/25 hover:text-foreground",
            )}
          >
            <span aria-hidden className="shrink-0 leading-none">
              🍽️
            </span>
            Il a mangé autre chose
          </button>
        )}
        <button
          type="button"
          aria-pressed={skipped}
          onClick={toggleSkip}
          className={cn(
            "flex min-h-14 items-center justify-center gap-2 rounded-md border-2 border-dashed px-2 text-center text-sm font-medium leading-tight transition-all active:translate-y-px",
            skipped
              ? "border-solid border-foreground/30 bg-muted text-foreground"
              : "border-border bg-transparent text-muted-foreground hover:border-foreground/25 hover:text-foreground",
          )}
        >
          <span aria-hidden className="shrink-0 leading-none">
            🚫
          </span>
          {skipped ? "Pas donné — annuler" : "Pas donné"}
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
