import { Fragment } from "react";
import { Snowflake as Freeze } from "lucide-react";
import { cn } from "@/lib/utils";
import { isBatchFreezable } from "@/lib/batch-cooking";
import {
  capitalize,
  composeRecipe,
  menuGlance,
  type RecipeStep,
} from "@/lib/recipe";
import { MealComposition } from "@/components/meal-composition";
import type { MealItem, MealWithDetails } from "@/lib/data/meals.types";
import type { FoodRow } from "@/lib/data/foods";

/**
 * A numbered sequence of steps. Each preparation restarts at 1: they are two
 * independent recipes, not one chain.
 *
 * The step's body is grey and the food it concerns leads in dark: from a
 * distance you follow the ingredient column, up close you read the action.
 */
function Steps({ steps }: { steps: RecipeStep[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-muted-foreground">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground tabular-nums">
            {i + 1}
          </span>
          <span className="leading-snug">
            {step.lead && (
              <span className="font-semibold text-foreground">
                {`${step.lead} : `}
              </span>
            )}
            {step.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * "nouveauté" — a food the child has never met. The same chip serves on the
 * unfolded card and on the thread's collapsed row: it is the same fact, so it
 * must look the same in both places.
 */
export function NoveltyPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-novelty-soft px-2.5 py-1 text-xs font-bold text-novelty">
      <span className="size-1.5 rounded-full bg-current" />
      nouveauté
    </span>
  );
}

/** Column or block heading, in quiet small caps. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-3.5 text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
      {children}
    </h4>
  );
}

/**
 * A meal's card: **one single card**, and everything about that meal inside it —
 * what is on the plate, how to prepare it, and how it went (`footer`).
 *
 * The rating block used to live in a separate card below this one: two cards, so
 * two subjects — when what is being rated is precisely the meal above. It is now
 * this card's footer, behind a plain rule.
 *
 * ── On a large screen ──────────────────────────────────────────────────────
 * Two columns from `lg` up: **the step-by-step on the left**, the composition on
 * the right. A full-width card stretched each line across 700 px for three
 * words, and pushed the quantities out of the reading zone.
 *
 * Preparation comes first because it is what you follow, pan in hand, from the
 * start of the meal to the end; the composition is consulted in glances.
 *
 * The split is 55/45 rather than 1fr plus a fixed column: food lines carry a
 * name, a quantity, two or three chips and the "Remplacer" button — too narrow,
 * that column wrapped while the left one still had room.
 *
 * ── On mobile ──────────────────────────────────────────────────────────────
 * The order flips: **the composition first**, the step-by-step after. You look
 * at what to take out of the fridge before you start cooking, and that is where
 * "Remplacer" sits — the gesture that helps when something is missing, so before
 * the first step, not after the last.
 *
 * Hence the DOM order: composition first, then the columns put back in place
 * from `lg` with `col-start` / `row-start`. Doing the reverse (`order` on the
 * mobile version) would have put the content in an order neither keyboard
 * navigation nor a screen reader follows.
 *
 * The tips (season, restriction) no longer form a block at the bottom of the
 * card: they sit on the line of the food concerned (`MealComposition`).
 */
export function MealCard({
  momentLabel,
  momentWindow,
  meal,
  ageMonths,
  introducedIds,
  upcomingCounts,
  substitution,
  notice,
  batchHint = true,
  footer,
}: {
  momentLabel: string;
  /**
   * The moment's window, "11 h – 14 h". Absent where the card places nothing in
   * a real day — the programme preview, the correction sheet.
   */
  momentWindow?: string;
  meal: MealWithDetails;
  /** Projected age in months, for quantities and texture. */
  ageMonths: number;
  introducedIds?: string[];
  /**
   * Upcoming occurrences per food (monthly horizon): used to offer the
   * least-seen substitute first.
   */
  upcomingCounts?: Record<string, number>;
  /**
   * Enables "Remplacer" on each food. Absent = read-only card (no-account
   * preview, collapsed upcoming days).
   */
  substitution?: { babyId: string; foods: FoodRow[] };
  /**
   * Block placed under the header, before the composition — the allergen
   * introduction warning. It used to float above the card, like a message with
   * no owner; yet it is about a food in this very meal.
   */
  notice?: React.ReactNode;
  /**
   * Batch-cooking hint ("carrot comes back 4 times, freeze 3 portions"). Cut
   * from the current day: it is a housekeeping tip, and it landed right above
   * the gesture we expect from the parent, as a full-width block. It keeps all
   * its point where you actually prepare — the programme preview.
   */
  batchHint?: boolean;
  /** The meal report — rendered in this card's footer, not in another one. */
  footer?: React.ReactNode;
}) {
  const month = Number(meal.date.slice(5, 7));
  const introducedSet = introducedIds ? new Set(introducedIds) : null;
  const recipe = composeRecipe(meal.meal_items, ageMonths);
  const glance = menuGlance(recipe);
  const hasSteps =
    recipe.parts.some((p) => p.steps.length > 0) ||
    recipe.extraSteps.length > 0;
  const titled = recipe.parts.length > 1;

  const foods = meal.meal_items
    .map((it) => it.food)
    .filter((f): f is NonNullable<MealItem["food"]> => f !== null);

  // Something new = a food never introduced. We highlight it.
  const novelty = introducedSet
    ? foods.find((f) => !introducedSet.has(f.id))
    : undefined;

  // Batch-cooking hint: the food that comes back most over the next month, among
  // those where freezing makes sense (see src/lib/batch-cooking.ts). A yoghurt
  // that comes back ten times is not prepared ahead, it is bought.
  const repeated =
    batchHint &&
    upcomingCounts &&
    foods
      .map((f) => ({ f, n: upcomingCounts[f.id] ?? 0 }))
      .filter((x) => x.n >= 3 && isBatchFreezable(x.f.name))
      .sort((a, b) => b.n - a.n)[0];

  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-soft">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 border-b px-5 py-4">
        <h3 className="flex items-center gap-2.5 font-heading text-lg font-semibold">
          {momentLabel}
          {momentWindow && (
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {momentWindow}
            </span>
          )}
          {novelty && <NoveltyPill />}
        </h3>
        {glance.dishes.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {"Au menu : "}
            {glance.dishes.map((dish, i) => (
              <Fragment key={i}>
                {i > 0 && ", puis "}
                <span className="font-semibold text-foreground">{dish}</span>
              </Fragment>
            ))}
            {glance.sides.length > 0 && (
              <>
                {", et "}
                <span className="font-semibold text-foreground">
                  {glance.sides.join(" & ").toLowerCase()}
                </span>
                {" à côté"}
              </>
            )}
            .
          </p>
        )}
      </header>

      {notice && <div className="border-b px-5 py-4">{notice}</div>}

      <div
        className={cn(
          hasSteps && "lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]",
        )}
      >
        <section
          className={cn(
            "px-5 py-4",
            hasSteps && "bg-card-inset lg:col-start-2 lg:row-start-1",
          )}
        >
          <Kicker>Dans l'assiette</Kicker>
          <MealComposition
            lines={recipe.lines}
            month={month}
            substitution={
              substitution && meal.meal_moment_id
                ? {
                    babyId: substitution.babyId,
                    date: meal.date,
                    momentId: meal.meal_moment_id,
                    foods: substitution.foods,
                    introducedIds: introducedIds ?? [],
                    ageMonths,
                    usage: upcomingCounts,
                  }
                : undefined
            }
          />
        </section>

        {/* Step-by-step, one list per preparation. The title only appears when
            there are genuinely two things to tell apart — a snack made of one
            compote has nothing to title. */}
        {hasSteps && (
          <section className="border-t px-5 py-4 lg:col-start-1 lg:row-start-1 lg:border-t-0 lg:border-r">
            <Kicker>Préparation</Kicker>
            <div className="space-y-5">
              {recipe.parts.map((part) => (
                <div key={part.course}>
                  {titled && (
                    <p className="mb-2.5 flex items-center gap-2.5 font-heading text-base font-semibold after:h-px after:flex-1 after:bg-border after:content-['']">
                      {capitalize(part.name)}
                    </p>
                  )}
                  <Steps steps={part.steps} />
                </div>
              ))}
              {recipe.extraSteps.length > 0 && (
                <Steps steps={recipe.extraSteps} />
              )}
            </div>
          </section>
        )}
      </div>

      {/* Batch-cooking hint, on a monthly horizon. A tip, not an alert: so it
          carries the green of tips, not the apricot of caution. */}
      {repeated && (
        <p className="flex items-start gap-3 border-t bg-secondary px-5 py-4 text-sm text-secondary-foreground">
          <Freeze className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-bold">
              {repeated.f.name} revient {repeated.n} fois
            </span>{" "}
            dans les semaines à venir. Prépares-en plus aujourd'hui et congèle{" "}
            {repeated.n - 1} portions — tout sera prêt d'avance.
          </span>
        </p>
      )}

      {/* Free note entered when rating */}
      {meal.note && (
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          📝 {meal.note}
        </p>
      )}

      {footer && <div className="border-t px-5 py-4">{footer}</div>}
    </article>
  );
}
