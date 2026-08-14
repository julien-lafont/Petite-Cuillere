"use client";

import { useState } from "react";
import { MealCard, NoveltyPill } from "@/components/meal-card";
import { MealActions } from "@/components/meal-actions";
import { MealSummaryRow } from "@/components/meal-summary-row";
import { MealRealitySheet } from "@/components/meal-reality-sheet";
import { AllergenExposureBanner } from "@/components/allergen-exposure-banner";
import { capitalize, composeRecipe, menuGlance } from "@/lib/recipe";
import { cursorMoment, phaseOf, windowLabel } from "@/lib/moments";
import {
  indexMeals,
  mealKey,
  type MealWithDetails,
} from "@/lib/data/meals.types";
import type { MealMoment } from "@/lib/data/meal-moments";
import type { FoodRow } from "@/lib/data/foods";

/**
 * The menu on one line, for a meal's folded version — "purée de courgette & œuf
 * dur, puis compote de pêche". Enough to recognise the meal, never enough to
 * think you are still reading the recipe.
 */
function summarize(meal: MealWithDetails, ageMonths: number): string {
  const glance = menuGlance(composeRecipe(meal.meal_items, ageMonths));
  const dishes = glance.dishes.join(", puis ");
  const sides = glance.sides.join(" & ").toLowerCase();

  if (dishes && sides) return capitalize(`${dishes}, et ${sides} à côté`);
  if (dishes) return capitalize(dishes);
  if (sides) return capitalize(sides);

  // No preparation to announce (only foods served as they are): the plain names
  // will do, better that than an empty line.
  return meal.meal_items
    .map((it) => it.food?.name)
    .filter(Boolean)
    .join(", ");
}

/**
 * A day that has not begun has no hour of its own: nothing on it has happened
 * yet. Feeding the thread a minute that precedes the whole day is all
 * `lib/moments` needs to say so — every slot reads as `future`, and the cursor
 * lands on the first meal of the day rather than on the one nearest the clock.
 */
const BEFORE_DAY = -1;

/**
 * The child's day, as one thread.
 *
 * ── Why a thread, and not a stack of cards ─────────────────────────────────
 * A meal card is a cooking document: composition, quantities, step-by-step,
 * replacements. You read it **before** the meal, and fill it in **after**.
 * Stacked, four unfolded cards ran to several screen heights, midday's recipe
 * still took its full space at 8pm, and the reporting gesture — the only one
 * left to do — was buried at the bottom of each of them.
 *
 * Hence three rules, and nothing else to remember:
 *
 *   1. the cursor goes to the **meal of the hour it is**: the one whose slot is
 *      current, else the next one coming, else the last one finished — that is,
 *      in every case, the closest to the time it is. It is the only unfolded
 *      card;
 *   2. a meal that has been filled in **folds away**, recipe and all, onto a row
 *      that states its status (`MealSummaryRow`). A tap reopens it. So the
 *      cursor only stops on meals left unanswered — otherwise lunch's "Ce repas
 *      est fait" reopened lunch;
 *   3. an upcoming meal is a row you can consult — you do prepare dinner at 3pm
 *      — but opening it does not make it confirmable by a distracted finger: you
 *      have to ask.
 *
 * ── The cursor used to follow completion, it follows the clock ─────────────
 * It went to the "first meal the parent said nothing about". A forgotten
 * breakfast therefore held it all day: at 7pm, the unfolded card was the
 * morning's, and dinner — the only meal the parent came for — sat folded three
 * rows below. The forgotten meal is not lost for all that: the catch-up strip
 * asks for it, at the top of the screen
 * (docs/feats/creneaux-horaires.md §6.1).
 *
 * The rating no longer lives in the card: it is offered afterwards, on the
 * folded row, and stays optional.
 */
export function TodayMeals({
  babyId,
  date,
  dateLabel,
  nowMinutes,
  moments,
  meals,
  ageMonths,
  introducedIds,
  upcomingCounts,
  foods,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  babyId: string;
  date: string;
  dateLabel: string;
  /**
   * Minutes since midnight, in the household's timezone — the hour it is.
   * `null` when the day shown is not today, which happens when today holds
   * nothing and the thread falls forward onto the next day that does.
   */
  nowMinutes: number | null;
  moments: MealMoment[];
  meals: MealWithDetails[];
  ageMonths: number;
  introducedIds?: string[];
  upcomingCounts?: Record<string, number>;
  /** Catalogue, for the "the menu changed" sheet. */
  foods: FoodRow[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
}) {
  // The meal the parent opened by hand. Null = the cursor is in charge, which is
  // the case nine times in ten.
  const [openId, setOpenId] = useState<string | null>(null);
  // Upcoming meals whose action bar the parent asked for.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [realityMomentId, setRealityMomentId] = useState<string | null>(null);

  const index = indexMeals(meals);
  const introducedSet = introducedIds ? new Set(introducedIds) : null;
  const minutes = nowMinutes ?? BEFORE_DAY;
  /** The day shown is ahead of today: none of its meals has had its turn. */
  const dayAhead = nowMinutes === null;

  const visible = moments.filter(
    (m) => (index.get(mealKey(date, m.id))?.meal_items.length ?? 0) > 0,
  );

  const realityMoment = moments.find((m) => m.id === realityMomentId) ?? null;
  const realityMeal = realityMomentId
    ? (index.get(mealKey(date, realityMomentId)) ?? null)
    : null;

  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-5 text-center text-muted-foreground">
        Rien de prévu aujourd'hui. Composez la semaine depuis l'onglet{" "}
        <span className="font-medium text-foreground">Ma semaine</span>.
      </p>
    );
  }

  // The clock decides, but only among meals nobody has said anything about yet:
  // a meal that has been filled in folds away, and the cursor cannot reopen it
  // right after the gesture that just closed it.
  const awaiting = visible.filter(
    (m) => index.get(mealKey(date, m.id))!.status === "prevu",
  );

  // The closest to the time it is, among those: current, else ahead, else the
  // last finished. The fallback used to take "the day's last meal", so the list
  // could end on a meal the clock had left long ago while the one next to it had
  // just finished.
  const cursor = cursorMoment(awaiting, minutes);
  const expandedId = openId ?? cursor?.id ?? null;

  /** The meal has just been filled in: the thread takes over again. */
  function settle(momentId: string) {
    setOpenId(null);
    setRevealed((prev) => {
      if (!prev.has(momentId)) return prev;
      const next = new Set(prev);
      next.delete(momentId);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {visible.map((moment) => {
        const meal = index.get(mealKey(date, moment.id))!;
        const foodsOfMeal = meal.meal_items.map((it) => it.food);

        // Discovery of the day: feeds the chip, and the message that follows a refusal
        // (« il faut souvent huit à dix essais »).
        const novelty = introducedSet
          ? foodsOfMeal.find((f) => f && !introducedSet.has(f.id))
          : null;

        if (moment.id !== expandedId) {
          return (
            <MealSummaryRow
              key={moment.id}
              babyId={babyId}
              date={date}
              momentId={moment.id}
              momentLabel={moment.label}
              summary={summarize(meal, ageMonths)}
              status={meal.status}
              result={meal.result}
              window={windowLabel(moment)}
              phase={phaseOf(moment, minutes)}
              noveltyName={novelty?.name ?? null}
              badge={
                novelty && meal.status === "prevu" ? <NoveltyPill /> : undefined
              }
              onOpen={() => setOpenId(moment.id)}
            />
          );
        }

        // Allergen introduction banner: the only case where the screen
        // changes register (see docs/ux-redesign.md §5). It lives inside the
        // relevant meal's card, not above it.
        const allergenItem = meal.meal_items.find(
          (it) =>
            it.food?.is_allergen &&
            (!introducedSet || !introducedSet.has(it.food.id)),
        );

        // An upcoming meal opened by hand shows no green button: you look
        // at its recipe to cook ahead, you do not close it by accident at
        // 3pm. The clock decides that now, no longer the difference with the
        // cursor: a past meal left unanswered is directly fillable, which is
        // the gesture we expect of it.
        const ahead =
          meal.status === "prevu" && phaseOf(moment, minutes) === "future";
        const armed = !ahead || revealed.has(moment.id);

        return (
          <MealCard
            key={moment.id}
            momentLabel={moment.label}
            momentWindow={windowLabel(moment)}
            meal={meal}
            ageMonths={ageMonths}
            introducedIds={introducedIds}
            upcomingCounts={upcomingCounts}
            substitution={{ babyId, foods }}
            batchHint={false}
            notice={
              allergenItem?.food ? (
                <AllergenExposureBanner
                  allergenName={
                    allergenItem.food.allergen_type ?? allergenItem.food.name
                  }
                  foodName={allergenItem.food.name}
                />
              ) : undefined
            }
            footer={
              armed ? (
                <MealActions
                  babyId={babyId}
                  date={date}
                  momentId={moment.id}
                  status={meal.status}
                  onMenuChanged={() => setRealityMomentId(moment.id)}
                  onSettled={() => settle(moment.id)}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {dayAhead
                      ? "Ce repas n'a pas encore eu lieu."
                      : "Ce repas vient plus tard dans la journée."}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setRevealed((prev) => new Set(prev).add(moment.id))
                    }
                    className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Le renseigner quand même
                  </button>
                </div>
              )
            }
          />
        );
      })}

      {realityMoment && (
        <MealRealitySheet
          key={`${date}|${realityMoment.id}`}
          open={!!realityMomentId}
          onOpenChange={(v) => {
            if (v) return;
            setRealityMomentId(null);
            // The sheet does not say whether it was confirmed or abandoned.
            // We hand control back to the cursor either way: after
            // confirmation that is what we want, and after an abandon the
            // cursor reopens the same meal — nothing visible happens.
            settle(realityMoment.id);
          }}
          babyId={babyId}
          date={date}
          momentId={realityMoment.id}
          momentLabel={realityMoment.label}
          dateLabel={dateLabel}
          meal={realityMeal}
          foods={foods}
          introducedIds={introducedIds ?? []}
          birthDate={birthDate}
          dueDate={dueDate}
          ageReferenceDate={ageReferenceDate}
        />
      )}
    </div>
  );
}
