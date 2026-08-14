"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Leaf, Loader2, Repeat, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";
import { freshnessAdvice } from "@/lib/season";
import { substituteFood } from "@/lib/data/meal-reality.actions";
import { findSubstitutes } from "@/lib/program/substitute";
import type { MealFoodLine } from "@/lib/recipe";
import type { FoodRow } from "@/lib/data/foods";

/**
 * What is on the plate: one food per line, with **everything about it on that
 * line** — quantity, allergen, season, restriction, and the replacement if
 * something is missing.
 *
 * The quantity sits right next to the name (`courge  ~150 g`) instead of being
 * pushed to the card's right edge: on a wide screen a `justify-between` moved it
 * several hundred pixels away from the food it describes, and nobody read it any
 * more.
 *
 * Season and restriction used to sit in a block of advice under the recipe ("la
 * pêche est hors saison…"): the parent had to make the connection with the right
 * line themselves. They are now placed on it, as chips — the restriction keeping
 * only its pictogram, with its sentence on hover.
 *
 * ── Replacement ────────────────────────────────────────────────────────────
 * Correcting **before** the meal beats reporting after (see
 * docs/feats/suivi-reel-et-rattrapage.md §4.2): the parent is standing at their
 * fridge, they get a useful answer in one tap, and the programme gets clean data
 * instead of silence.
 *
 * The action is called "Remplacer", not "je n'en ai pas": the link described the
 * parent's situation instead of naming what the button does, and nobody realised
 * there was an action there. Three substitutes, no more: enough to choose, not
 * enough to dither.
 */
export function MealComposition({
  lines,
  month,
  substitution,
}: {
  lines: MealFoodLine[];
  /** Month of the meal (1..12), for the season indicator. */
  month: number;
  /**
   * Enables replacement. Absent = read-only card (no-account preview, collapsed
   * upcoming days).
   */
  substitution?: {
    babyId: string;
    date: string;
    momentId: string;
    foods: FoodRow[];
    introducedIds: string[];
    ageMonths: number;
    /** Upcoming occurrences per food — to offer the least-seen first. */
    usage?: Record<string, number>;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const introducedSet = new Set(substitution?.introducedIds ?? []);
  const inMeal = new Set(lines.map((l) => l.id));

  function swap(fromId: string, toId: string) {
    if (!substitution) return;
    const { babyId, date, momentId } = substitution;
    setOpenId(null);
    startTransition(async () => {
      const res = await substituteFood(babyId, date, momentId, fromId, toId);
      router.refresh();
      setMessage(res.sentence);
    });
  }

  return (
    <div className="space-y-2">
      <ul>
        {lines.map((line, i) => {
          const food = substitution?.foods.find((f) => f.id === line.id);
          // An allergen protocol dose is not replaceable: it is the
          // prescribed carrier, at that step. Offering a swap here would break
          // the protocol without the parent being able to know.
          const substitutes =
            substitution && food && !line.isPrescribedDose
              ? findSubstitutes(food, substitution.foods, {
                  introducedIds: introducedSet,
                  usage: substitution.usage,
                  ageMonths: substitution.ageMonths,
                  exclude: inMeal,
                })
              : [];
          const isOpen = openId === line.id;
          const advice = freshnessAdvice(line.season, month);

          return (
            <li
              key={line.id}
              className={cn(
                "py-2 first:pt-0 last:pb-0",
                // The rule separates the savoury purée from dessert: two
                // preparations, two moments of the meal.
                i > 0 && line.course !== lines[i - 1].course && "border-t",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-heading text-base font-semibold">
                    {line.name}
                  </span>
                  {/* An allergen protocol dose is not a guideline to adjust to
                      appetite: we set it apart from the portion. */}
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      line.isPrescribedDose
                        ? "text-novelty"
                        : "text-muted-foreground",
                    )}
                  >
                    {line.portion.label}
                  </span>
                  {line.isAllergen && (
                    <Tag className="bg-novelty-soft text-novelty">
                      allergène
                    </Tag>
                  )}
                  {advice === "frais" && (
                    <Tag
                      className="bg-secondary text-secondary-foreground"
                      title={`${line.name} est de saison — profitez-en frais.`}
                    >
                      <Leaf className="size-3" />
                      de saison
                    </Tag>
                  )}
                  {advice === "surgele" && (
                    <Tag
                      className="bg-muted text-muted-foreground"
                      title={`${line.name} est hors saison — le surgelé fait très bien l'affaire.`}
                    >
                      <Snowflake className="size-3" />
                      surgelé
                    </Tag>
                  )}
                  {/* The restriction ("jamais cru avant 5 ans") used to take a
                      whole line under each food concerned: three red lines under
                      a four-ingredient recipe, and the composition was no longer
                      readable. It folds behind the pictogram, and reads again on
                      hover. */}
                  {line.restrictions && (
                    <Tag
                      className="bg-destructive/10 text-destructive"
                      title={line.restrictions}
                      aria-label={line.restrictions}
                    >
                      <AlertTriangle className="size-3" />
                    </Tag>
                  )}
                </div>

                {substitutes.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : line.id)}
                    className={cn(
                      // Sitting on the column's cream, the button stands out by
                      // its white fill: dotted on a tinted background, it read as
                      // an empty area to fill in.
                      "flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] bg-card px-2.5 text-xs font-semibold transition-colors",
                      isOpen
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                    )}
                  >
                    <Repeat className="size-3.5" />
                    Remplacer
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="mt-2 rounded-md bg-muted/60 p-2.5">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Remplacer {line.name.toLowerCase()} par
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {substitutes.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => swap(line.id, s.id)}
                        className="flex min-h-9 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      >
                        {isPending && (
                          <Loader2 className="size-3 animate-spin" />
                        )}
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {message && (
        <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          {message}
        </p>
      )}
    </div>
  );
}

/** Information chip placed on a food — pale background, contrasted text. */
function Tag({
  className,
  title,
  "aria-label": ariaLabel,
  children,
}: {
  className?: string;
  title?: string;
  /** Required when the chip's only content is a pictogram. */
  "aria-label"?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 self-center rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
