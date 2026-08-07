"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { setMealResult } from "@/lib/data/meals.actions";
import {
  confirmMealsAsPlanned,
  setMealSkipped,
} from "@/lib/data/meal-reality.actions";
import type { MealResult } from "@/lib/data/meals.types";

/**
 * La bande de rattrapage — les repas passés restés sans signal.
 *
 * Décisions (docs/feats/suivi-reel-et-rattrapage.md §4.4) :
 *
 *  · **Deux jours glissants au maximum.** Au-delà, la bande disparaît d'elle-
 *    même. Un parent absent une semaine ne doit pas retrouver quinze lignes en
 *    retard : ce serait exactement la dette qu'on s'interdit (D8).
 *  · **« Tout s'est passé comme prévu » confirme tout d'un coup** — un tap pour
 *    deux jours. C'est ce bouton qui rend le système viable, et donc le premier
 *    à surveiller lors des tests utilisateurs.
 *  · Ton : « il vous restait deux repas », jamais « 2 repas non renseignés ».
 */

export type PendingMeal = {
  date: string;
  /** « hier », « avant-hier » — jamais une date brute, on parle à un humain. */
  dayLabel: string;
  momentId: string;
  momentLabel: string;
  /** Résumé des aliments prévus, déjà mis en forme côté serveur. */
  summary: string;
};

const QUICK: {
  value: Exclude<MealResult, null>;
  emoji: string;
  cls: string;
}[] = [
  { value: "bien", emoji: "😋", cls: "hover:bg-primary/10" },
  { value: "moyen", emoji: "😐", cls: "hover:bg-chart-3/15" },
  { value: "refuse", emoji: "🙅", cls: "hover:bg-destructive/10" },
];

export function CatchUpStrip({
  babyId,
  meals,
  fromISO,
  toISO,
}: {
  babyId: string;
  meals: PendingMeal[];
  /** Bornes de la confirmation groupée. */
  fromISO: string;
  toISO: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Optimiste : une ligne réglée disparaît tout de suite, sans attendre le
  // serveur. Le parent enchaîne au rythme du pouce, pas du réseau.
  const [done, setDone] = useState<Set<string>>(new Set());

  const remaining = meals.filter((m) => !done.has(`${m.date}|${m.momentId}`));
  if (remaining.length === 0) return null;

  const settle = (m: PendingMeal) =>
    setDone((prev) => new Set(prev).add(`${m.date}|${m.momentId}`));

  function rate(m: PendingMeal, result: Exclude<MealResult, null>) {
    settle(m);
    startTransition(async () => {
      await setMealResult(babyId, m.date, m.momentId, result);
      router.refresh();
    });
  }

  function skip(m: PendingMeal) {
    settle(m);
    startTransition(async () => {
      await setMealSkipped(babyId, m.date, m.momentId, true);
      router.refresh();
    });
  }

  function confirmAll() {
    setDone(new Set(meals.map((m) => `${m.date}|${m.momentId}`)));
    startTransition(async () => {
      await confirmMealsAsPlanned(babyId, fromISO, toISO);
      router.refresh();
    });
  }

  // Regroupement par jour, dans l'ordre où ils se sont produits.
  const byDay = new Map<string, PendingMeal[]>();
  for (const m of remaining) {
    const list = byDay.get(m.dayLabel) ?? [];
    list.push(m);
    byDay.set(m.dayLabel, list);
  }

  return (
    <section className="rounded-lg border bg-card px-4 py-4 shadow-soft">
      <p className="font-heading font-semibold">
        {remaining.length === 1
          ? "Il vous restait un repas à renseigner"
          : `Il vous restait ${remaining.length} repas à renseigner`}
      </p>

      <div className="mt-3 space-y-3">
        {[...byDay].map(([dayLabel, dayMeals]) => (
          <div key={dayLabel} className="space-y-1.5">
            <p className="text-xs font-semibold capitalize text-muted-foreground">
              {dayLabel}
            </p>
            {dayMeals.map((m) => (
              <div
                key={`${m.date}|${m.momentId}`}
                className="flex items-center justify-between gap-2"
              >
                <p className="min-w-0 truncate text-sm">
                  <span className="font-medium">{m.momentLabel}</span>
                  <span className="text-muted-foreground"> · {m.summary}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  {QUICK.map((q) => (
                    <button
                      key={q.value}
                      type="button"
                      aria-label={q.value}
                      onClick={() => rate(m, q.value)}
                      className={cn(
                        "grid size-10 place-items-center rounded-md text-lg transition-colors",
                        q.cls,
                      )}
                    >
                      {q.emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    aria-label="Pas donné"
                    onClick={() => skip(m)}
                    className="grid size-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Ban className="size-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={confirmAll}
        disabled={isPending}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Tout s'est passé comme prévu
      </button>
    </section>
  );
}
