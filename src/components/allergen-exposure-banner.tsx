"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setItemSkipped } from "@/lib/data/meal-reality.actions";

/**
 * Le bandeau d'introduction d'allergène — le seul endroit où l'écran change de
 * registre (cf. docs/ux-redesign.md §5), doublé de la seule confirmation
 * explicite que le produit demande.
 *
 * Pourquoi ici, et seulement ici : le parent peut très bien donner la purée et
 * sauter la cuillère d'œuf. Partout ailleurs cette finesse ne mériterait pas un
 * geste de plus ; sur un allergène, croire l'enfant exposé alors qu'il ne l'a
 * pas été est le seul mensonge dangereux que l'app puisse produire
 * (docs/feats/suivi-reel-et-rattrapage.md §3).
 *
 * Deux cibles, jamais de champ, jamais de modale. Et un ton qui informe sans
 * alarmer : ce bandeau s'adresse à un parent déjà inquiet.
 */
export function AllergenExposureBanner({
  babyId,
  allergenName,
  foodName,
  mealItemId,
  skipped,
  askConfirmation,
}: {
  babyId: string;
  allergenName: string;
  foodName: string;
  mealItemId: string;
  skipped: boolean;
  /**
   * Ne demander qu'une fois le repas renseigné. Interroger un parent à 6 h du
   * matin sur ce que l'enfant mangera à midi serait absurde — et le bandeau
   * doit d'abord informer.
   */
  askConfirmation: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [given, setGiven] = useState<boolean | null>(skipped ? false : null);

  function answer(wasGiven: boolean) {
    setGiven(wasGiven);
    startTransition(async () => {
      await setItemSkipped(babyId, mealItemId, !wasGiven);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3 rounded-md border border-novelty/30 bg-novelty-soft px-4 py-3 text-sm">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-novelty" />
        <p className="text-foreground/85">
          {given === false ? (
            <>
              <span className="font-semibold">
                {allergenName.toLowerCase()}
              </span>{" "}
              n'a pas été donné — on le reproposera.
            </>
          ) : (
            <>
              Aujourd'hui, première fois avec{" "}
              <span className="font-semibold">
                {allergenName.toLowerCase()}
              </span>
              , dans {foodName.toLowerCase()}. Proposez-le plutôt le matin ou le
              midi et restez attentif dans les heures qui suivent.
            </>
          )}
        </p>
      </div>

      {given === false ? (
        <button
          type="button"
          onClick={() => answer(true)}
          disabled={isPending}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Undo2 className="size-4" />
          Finalement, il l'a eu
        </button>
      ) : (
        askConfirmation && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground/70">
              {foodName}, il l'a bien eu ?
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => answer(true)}
                disabled={isPending}
                className={cn(
                  "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-md border-2 text-sm font-semibold transition-colors",
                  given === true
                    ? "border-primary bg-primary/12 text-primary"
                    : "border-transparent bg-card/60 text-muted-foreground hover:bg-card",
                )}
              >
                {given === true && <Check className="size-4" />}
                Oui
              </button>
              <button
                type="button"
                onClick={() => answer(false)}
                disabled={isPending}
                className="min-h-10 flex-1 rounded-md border-2 border-transparent bg-card/60 text-sm font-semibold text-muted-foreground transition-colors hover:bg-card"
              >
                Non, pas cette fois
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
}
