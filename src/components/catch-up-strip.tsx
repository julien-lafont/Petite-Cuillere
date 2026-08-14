"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { composeRecipe } from "@/lib/recipe";
import { setMealResult } from "@/lib/data/meals.actions";
import {
  confirmMealsAsPlanned,
  setMealSkipped,
} from "@/lib/data/meal-reality.actions";
import { MealComposition } from "@/components/meal-composition";
import type { MealResult, MealWithDetails } from "@/lib/data/meals.types";

/**
 * The catch-up strip — past meals left without a signal.
 *
 * Decisions (docs/feats/suivi-reel-et-rattrapage.md §4.4):
 *
 *  · **Two rolling days at most**, and **completed** days only. Beyond that the
 *    strip disappears on its own. A parent away for a week must not come back to
 *    fifteen overdue rows: that would be exactly the debt we forbid ourselves
 *    (D8). It is the one place in the product that *adds* a demand — the first
 *    to watch in user testing.
 *  · **The current day is not its business.** It was for a while, so a meal from
 *    this morning did not wait for midnight; but the day thread already shows
 *    those meals, on a row that says "à renseigner" and opens in one tap. The
 *    strip showed them a second time, targets included, a few centimetres from
 *    the first. What it asks for now is what no other screen shows: yesterday's
 *    and the day before's meals.
 *  · **"Tout s'est passé comme prévu" confirms everything at once** — one tap for
 *    two days. That button is what makes the system viable, and so the first to
 *    watch in user testing.
 *  · Tone: "il vous restait deux repas", never "2 repas non renseignés".
 *
 * ── Fix of 2026-08-09: you could not see what was planned ───────────────────
 * The first version kept a meal on **one row**: the moment, the food summary,
 * and the four targets on the right. The targets alone took 175 px of a phone's
 * ~330 usable, so the summary was truncated at the third word ("Déjeuner ·
 * Haricot ve…"). We were asking the parent to judge a meal they could not read.
 *
 * Three changes, one idea — give the meal room to describe itself:
 *
 *  1. **The foods take their own row**, as chips that wrap instead of being cut
 *     off, and the targets move down one rank.
 *  2. **The chevron unfolds the planned composition** — quantities, allergen,
 *     season, restrictions — through the recipe card's `MealComposition`. Not
 *     the step-by-step: you do not cook yesterday's meal, you remember it. It is
 *     the gesture already established on "Les jours qui viennent".
 *  3. **The targets are labelled** (loved / mixed / refused / not given), as in
 *     `MealQuickRating`. Four bare emoji left you guessing, and their
 *     `aria-label` announced the raw enum value ("refuse").
 *
 * Hover was ruled out as a reveal mechanism: catch-up happens on a phone,
 * one-handed, and there is no hover there.
 */

export type PendingMeal = {
  date: string;
  /** "hier", "avant-hier" — never a raw date, we are talking to a human. */
  dayLabel: string;
  momentId: string;
  momentLabel: string;
  /** The planned meal — feeds the collapsed chips and the unfolded composition. */
  meal: MealWithDetails;
};

/**
 * The four possible answers, in the order of the gesture. "Pas donné" carries
 * `MealQuickRating`'s dotted outline: at equal size, that is what separates "how
 * it went" from "it did not happen".
 */
const ANSWERS: {
  value: Exclude<MealResult, null> | "skip";
  emoji: string;
  label: string;
  cls: string;
}[] = [
  {
    value: "bien",
    emoji: "😋",
    label: "Adoré",
    cls: "border-border hover:border-primary hover:text-primary",
  },
  {
    value: "moyen",
    emoji: "😐",
    label: "Moyen",
    cls: "border-border hover:border-chart-3 hover:text-amber-700",
  },
  {
    value: "refuse",
    emoji: "🙅",
    label: "Refusé",
    cls: "border-border hover:border-destructive hover:text-destructive",
  },
  {
    value: "skip",
    emoji: "🚫",
    label: "Pas donné",
    cls: "border-dashed border-border hover:border-foreground/25 hover:text-foreground",
  },
];

export function CatchUpStrip({
  babyId,
  meals,
  ageMonths,
  fromISO,
  toISO,
}: {
  babyId: string;
  meals: PendingMeal[];
  /** Projected age in months — drives the quantities in the unfolded composition. */
  ageMonths: number;
  /** Bounds of the bulk confirmation. */
  fromISO: string;
  /** Last day covered — yesterday, never today. */
  toISO: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Optimistic: a row that is answered disappears at once, without waiting for
  // the server. The parent moves at the pace of their thumb, not the network.
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());

  const remaining = meals.filter((m) => !done.has(key(m)));
  if (remaining.length === 0) return null;

  function toggle(m: PendingMeal) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key(m))) next.delete(key(m));
      else next.add(key(m));
      return next;
    });
  }

  function answer(m: PendingMeal, value: (typeof ANSWERS)[number]["value"]) {
    setDone((prev) => new Set(prev).add(key(m)));
    startTransition(async () => {
      if (value === "skip")
        await setMealSkipped(babyId, m.date, m.momentId, true);
      else await setMealResult(babyId, m.date, m.momentId, value);
      router.refresh();
    });
  }

  function confirmAll() {
    setDone(new Set(meals.map(key)));
    startTransition(async () => {
      await confirmMealsAsPlanned(babyId, fromISO, toISO);
      router.refresh();
    });
  }

  // Grouped by day, in the order they happened.
  const byDay = new Map<string, PendingMeal[]>();
  for (const m of remaining) {
    const list = byDay.get(m.dayLabel) ?? [];
    list.push(m);
    byDay.set(m.dayLabel, list);
  }

  return (
    <section className="rounded-lg border bg-card px-4 py-4 shadow-soft">
      {/* The past tense, because these are completed days — it is also what
          tells the parent these rows are not about today. */}
      <p className="font-heading font-semibold">
        {remaining.length === 1
          ? "Il vous restait un repas à renseigner"
          : `Il vous restait ${remaining.length} repas à renseigner`}
      </p>

      <div className="mt-3 space-y-3">
        {[...byDay].map(([dayLabel, dayMeals]) => (
          <div key={dayLabel} className="space-y-2">
            <p className="text-xs font-semibold capitalize text-muted-foreground">
              {dayLabel}
            </p>
            {dayMeals.map((m) => (
              <MealRow
                key={key(m)}
                meal={m}
                ageMonths={ageMonths}
                isOpen={open.has(key(m))}
                onToggle={() => toggle(m)}
                onAnswer={(value) => answer(m, value)}
              />
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

/** A slot's identity — a meal is located by its day and its moment. */
function key(m: PendingMeal) {
  return `${m.date}|${m.momentId}`;
}

/**
 * A meal running late: what was planned above, the answer below.
 *
 * Collapsed, it fits in two rows and already says the essentials — the moment
 * and the foods, all of them, untruncated. Unfolded, it shows the full
 * composition.
 *
 * ── Large screens: collapsed, a row is a row ────────────────────────────────
 * The two rows come from the phone, where width is the scarce resource. On a
 * desktop screen they stacked two full-width blocks per meal, and the catch-up
 * strip ate the first screen on its own. Collapsed, a meal therefore goes back
 * to **one row**: what was planned takes 60 % of the width, the four targets the
 * 40 % on the right.
 *
 * Unfolded, we go back to stacking: the composition needs the full width, and
 * the targets return to their row below — that is the moment the parent reads
 * before judging, not the moment they scan a list.
 *
 * The breakpoint is `lg` and not `md`: the navigation column already takes
 * 256 px from `md` up, which would leave only ~165 px for four buttons.
 */
function MealRow({
  meal: m,
  ageMonths,
  isOpen,
  onToggle,
  onAnswer,
}: {
  meal: PendingMeal;
  ageMonths: number;
  isOpen: boolean;
  onToggle: () => void;
  onAnswer: (value: (typeof ANSWERS)[number]["value"]) => void;
}) {
  const items = m.meal.meal_items;
  const hasDetails = items.length > 0;

  // The same food can appear twice (purée and dessert): one chip.
  const chips: { id: string; name: string }[] = [];
  for (const item of items) {
    if (item.food && !chips.some((c) => c.id === item.food!.id))
      chips.push({ id: item.food.id, name: item.food.name });
  }

  const header = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-heading font-semibold">
          {m.momentLabel}
        </span>
        {chips.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {c.name}
              </span>
            ))}
          </span>
        )}
      </span>
      {hasDetails && (
        <ChevronDown
          aria-hidden
          className={cn(
            "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      )}
    </>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-card-inset",
        !isOpen && "lg:flex lg:items-stretch",
      )}
    >
      {/* With no composition to show there is nothing to unfold: the title
          stays a title rather than a button that would do nothing. */}
      {hasDetails ? (
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
          className={cn(
            "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
            !isOpen && "lg:w-3/5",
          )}
        >
          {header}
        </button>
      ) : (
        <div
          className={cn(
            "flex items-start gap-3 px-3 py-2.5",
            !isOpen && "lg:w-3/5",
          )}
        >
          {header}
        </div>
      )}

      {isOpen && hasDetails && (
        <div className="border-t bg-card px-3 py-3">
          <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Ce qui était prévu
          </h4>
          <MealComposition
            lines={composeRecipe(items, ageMonths).lines}
            month={Number(m.date.slice(5, 7))}
          />
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-4 gap-1.5 border-t p-1.5",
          // On the single-line layout the divider is vertical, and the area
          // will not be squeezed by over-long food chips.
          !isOpen && "lg:w-2/5 lg:shrink-0 lg:border-l lg:border-t-0",
        )}
      >
        {ANSWERS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => onAnswer(a.value)}
            className={cn(
              "flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-md border-[1.5px] bg-card px-1 text-[0.6875rem] font-semibold leading-none text-muted-foreground transition-colors",
              a.cls,
            )}
          >
            <span aria-hidden className="text-xl leading-none">
              {a.emoji}
            </span>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
