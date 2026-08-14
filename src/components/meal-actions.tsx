"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { setMealServed, setMealSkipped } from "@/lib/data/meal-reality.actions";
import type { MealStatus } from "@/lib/data/meals.types";

/**
 * A meal's action bar — three targets, one question.
 *
 * What was missing first was not "how did it go?" but "did this meal happen?":
 * the first question presupposes the answer to the second. So the card footer
 * asked for a rating to close a meal, and you had to judge the child to fill in
 * the app.
 *
 * A meal's three real outcomes now sit side by side, each named by what it does:
 *
 *   ✓ Ce repas est fait        → served
 *     Repas sauté              → skipped
 *     Le menu a changé         → replaced (opens the composition sheet)
 *
 * They replace the previous five tiles (three emoji, two dotted) and the
 * underlined link that followed them. The old label "Il a mangé autre chose"
 * described a situation; "Le menu a changé" names the gesture, and has no gender
 * to agree.
 *
 * The hierarchy comes from the fill, not the size: a solid pill for the common
 * path, two outlined pills for the divergences. All three share one shape —
 * which was what was missing most, a single graphic family where there were
 * five.
 *
 * The rating no longer lives here: it is offered afterwards, on the closed
 * meal's summary row (`MealSummaryRow`), and stays optional — an unrated meal
 * simply stays unrated (scoping decision D8).
 *
 * Optimistic: the state shows immediately, the write follows. Tapping the active
 * state again clears it, as everywhere else — there is no separate "undo" button
 * to hunt for.
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
  /** The meal has just been filled in — the thread can move on. */
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
