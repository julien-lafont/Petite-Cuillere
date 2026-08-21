"use client";

import { useState, useTransition } from "react";
import {
  AlertTriangle,
  Ban,
  Check,
  ChevronDown,
  Heart,
  HelpCircle,
  Loader2,
  Plus,
  Repeat,
  Utensils,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createDictatedFood } from "@/lib/data/voice.actions";
import type { FoodRow } from "@/lib/data/foods";
import type { MealMoment } from "@/lib/data/meal-moments";
import type {
  Appreciation,
  ResolvedFood,
  ResolvedIntent,
} from "@/lib/voice/types";

/**
 * One block of the confirmation card: an intent understood, as the app is about
 * to run it.
 *
 * The block always carries four things in the same order, because that is the
 * order a parent checks them in (docs/feats/commande-vocale.md §5.3): **what**
 * (the icon and title say the action), **when** (the slot, always editable in
 * one tap — the app may have guessed, it does not decide), **with what** (the
 * foods, as chips like everywhere else), then **what it will do** (the impact
 * message, before confirmation rather than after).
 *
 * Each family of actions has its colour and its icon: with two blocks stacked,
 * the difference between "il a mangé" and "on a sauté ce repas" must be visible
 * before it is read.
 */

export type Block = ResolvedIntent & {
  /** Does this order go out on confirmation? */
  selected: boolean;
};

/** The visual identity of a family of actions. */
type Signature = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  /** The icon's badge. Pastel backgrounds never carry the meaning alone. */
  badge: string;
};

/**
 * The rating reuses the three faces from real tracking: it is the same
 * vocabulary as everywhere else in the app, and it reads before it is read.
 */
function AppreciationChip({ value }: { value: Appreciation }) {
  const [emoji, label, tone] =
    value === "bien"
      ? ["😋", "Il a aimé", "bg-secondary text-secondary-foreground"]
      : value === "moyen"
        ? ["😐", "Il a moyennement aimé", "bg-muted text-muted-foreground"]
        : ["🙅", "Il a refusé", "bg-novelty-soft text-foreground/85"];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
        tone,
      )}
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </span>
  );
}

function FoodLabel({ food }: { food: ResolvedFood }) {
  if (food.state === "unknown") return <>{food.spoken}</>;
  return (
    <>
      {food.name}
      {/* The reminder of what was heard is not split in two: a closing
          quote alone on its line reads as a typo. */}
      {food.approximate && (
        <span className="ml-1 text-xs font-normal whitespace-nowrap opacity-70">
          (« {food.spoken} »)
        </span>
      )}
    </>
  );
}

export function VoiceIntentBlock({
  block,
  moments,
  foods,
  foodById,
  introduced,
  ageMonths,
  withCheckbox,
  onChange,
  onFollowUp,
}: {
  block: Block;
  moments: MealMoment[];
  foods: FoodRow[];
  foodById: Map<string, FoodRow>;
  introduced: Set<string>;
  ageMonths: number;
  withCheckbox: boolean;
  onChange: (patch: (block: Block) => Block) => void;
  onFollowUp: (text: string) => void;
}) {
  const [query, setQuery] = useState<string | null>(null);
  const [creating, create] = useTransition();
  const detail = block.detail;
  const [pickingMoment, setPickingMoment] = useState(
    detail.type !== "askClarification" && detail.slot.momentInferred,
  );

  // A request for clarification is not an order: it has no slot, no checkbox,
  // and its only gesture is to answer.
  if (detail.type === "askClarification") {
    return (
      <div className="rounded-xl border border-dashed border-novelty/40 bg-novelty-soft/50 p-4">
        <p className="flex items-start gap-2.5 text-sm font-semibold">
          <HelpCircle className="mt-0.5 size-4.5 shrink-0 text-novelty" />
          {detail.question}
        </p>
        {detail.options.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 pl-7">
            {detail.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onFollowUp(option)}
                className="min-h-11 rounded-full border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent/40"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const signature: Signature =
    detail.type === "skipMeal"
      ? detail.cancel
        ? {
            title: "Finalement, il a mangé",
            icon: Utensils,
            badge: "bg-secondary text-secondary-foreground",
          }
        : {
            title: "Repas non donné",
            icon: Ban,
            badge: "bg-muted text-muted-foreground",
          }
      : detail.type === "rateMeal"
        ? {
            title: "Comment ça s'est passé",
            icon: Heart,
            badge: "bg-novelty-soft text-novelty",
          }
        : detail.type === "substituteFood"
          ? {
              title: "Remplacement",
              icon: Repeat,
              badge: "bg-accent text-accent-foreground",
            }
          : detail.nature === "prevision"
            ? {
                title: "Au menu",
                icon: Utensils,
                badge: "bg-novelty-soft text-novelty",
              }
            : {
                title: "Ce qu'il a mangé",
                icon: Utensils,
                badge: "bg-secondary text-secondary-foreground",
              };

  const chosenFoods =
    detail.type === "logMeal"
      ? detail.foods
          .filter((food) => food.state === "resolved")
          .map((food) => foodById.get((food as { id: string }).id))
          .filter((food): food is FoodRow => Boolean(food))
      : [];
  const novelties = chosenFoods.filter((food) => !introduced.has(food.id));
  const tooYoung = chosenFoods.filter(
    (food) => (food.age_introduction_min ?? 0) > ageMonths,
  );
  const restricted = chosenFoods.filter((food) => food.restrictions);

  const searchResults =
    query !== null && query.trim().length >= 2
      ? foods
          .filter((food) =>
            food.name.toLowerCase().includes(query.trim().toLowerCase()),
          )
          .slice(0, 12)
      : [];

  function addFood(food: FoodRow) {
    onChange((current) => {
      if (current.detail.type !== "logMeal") return current;
      const already = current.detail.foods.some(
        (f) => f.state === "resolved" && f.id === food.id,
      );
      if (already) return current;
      const nextFoods: ResolvedFood[] = [
        ...current.detail.foods,
        {
          state: "resolved",
          id: food.id,
          name: food.name,
          spoken: food.name,
          approximate: false,
        },
      ];
      const complete = nextFoods.every((f) => f.state === "resolved");
      return {
        ...current,
        ready: complete,
        issue: complete ? null : current.issue,
        selected: complete,
        detail: { ...current.detail, foods: nextFoods },
      };
    });
    setQuery(null);
  }

  function removeFood(index: number) {
    onChange((current) => {
      if (current.detail.type !== "logMeal") return current;
      const nextFoods = current.detail.foods.filter((_, i) => i !== index);
      const complete =
        nextFoods.length > 0 && nextFoods.every((f) => f.state === "resolved");
      return {
        ...current,
        ready: complete,
        issue: complete
          ? null
          : nextFoods.length === 0
            ? "Aucun aliment retenu."
            : current.issue,
        selected: complete && current.selected,
        detail: { ...current.detail, foods: nextFoods },
      };
    });
  }

  function createUnknown(spoken: string, index: number) {
    create(async () => {
      const result = await createDictatedFood(spoken);
      if ("error" in result) return;
      onChange((current) => {
        if (current.detail.type !== "logMeal") return current;
        const nextFoods = current.detail.foods.map((food, i) =>
          i === index
            ? ({
                state: "resolved",
                id: result.id,
                name: spoken,
                spoken,
                approximate: false,
              } as ResolvedFood)
            : food,
        );
        const complete = nextFoods.every((f) => f.state === "resolved");
        return {
          ...current,
          ready: complete,
          issue: complete ? null : current.issue,
          selected: complete,
          detail: { ...current.detail, foods: nextFoods },
        };
      });
    });
  }

  /**
   * The parent settles the slot.
   *
   * Two effects, not one: the moment changes, and the ambiguity blocking the
   * block falls with it. Without the second, tapping a chip would leave the
   * block greyed out — the question asked, the answer given, and nothing moving.
   *
   * Ambiguity is not the only possible block: a meal with a food still unknown
   * to the catalogue stays blocked after the slot is chosen.
   */
  function pickMoment(moment: MealMoment) {
    setPickingMoment(false);
    onChange((current) => {
      if (current.detail.type === "askClarification") return current;
      const wasAmbiguous = current.detail.slot.momentAmbiguous;
      const otherwiseReady =
        current.detail.type !== "logMeal" ||
        (current.detail.foods.length > 0 &&
          current.detail.foods.every((f) => f.state === "resolved"));
      const lifted = wasAmbiguous && otherwiseReady;

      return {
        ...current,
        ready: lifted ? true : current.ready,
        issue: lifted ? null : current.issue,
        selected: lifted ? true : current.selected,
        detail: {
          ...current.detail,
          slot: {
            ...current.detail.slot,
            momentId: moment.id,
            momentLabel: moment.label,
            momentInferred: false,
            momentAmbiguous: false,
          },
        },
      };
    });
  }

  function pickSubstitute(id: string, name: string) {
    onChange((current) => {
      if (current.detail.type !== "substituteFood") return current;
      return {
        ...current,
        ready: current.detail.missing.state === "resolved",
        issue: null,
        selected: true,
        detail: {
          ...current.detail,
          replacement: {
            state: "resolved",
            id,
            name,
            spoken: name,
            approximate: false,
          },
        },
      };
    });
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-card-inset p-4 ring-1 ring-border/70 transition-opacity",
        withCheckbox && !block.selected && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        {withCheckbox && (
          <input
            type="checkbox"
            checked={block.selected}
            disabled={!block.ready}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                selected: event.target.checked,
              }))
            }
            aria-label={`Retenir : ${signature.title}`}
            className="size-5 shrink-0 accent-primary"
          />
        )}
        <span
          aria-hidden
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            signature.badge,
          )}
        >
          <signature.icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base leading-tight font-semibold">
            {signature.title}
          </p>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {block.babyName} · {detail.slot.dateLabel}
          </p>
        </div>
      </div>

      {/*
       * The moment is always shown; the full list only opens when it is useful.
       * Four chips on two lines, repeated on every block, drowned the essentials
       * — and the card has to stay readable at a glance (§9.8). When the app
       * guessed, it opens by itself: that is precisely the case where the parent
       * must be able to correct in one tap.
       *
       * And when nothing imposes itself — at 10:30, "il mange de la pomme",
       * between two slots — "Deviné" gives way to the question itself:
       * "Petit-déjeuner ou déjeuner ?". The block is not runnable until a chip
       * has been tapped (docs/feats/creneaux-horaires.md §7.4).
       */}
      {!pickingMoment ? (
        <button
          type="button"
          onClick={() => setPickingMoment(true)}
          className={cn(
            "mt-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent/40",
            "border-transparent bg-card",
          )}
        >
          {detail.slot.momentLabel}
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {detail.slot.momentAmbiguous ? (
            <span className="text-xs font-semibold text-foreground">
              {block.issue ?? "De quel repas parlez-vous ?"}
            </span>
          ) : (
            detail.slot.momentInferred && (
              <span className="text-xs font-semibold text-muted-foreground">
                Deviné :
              </span>
            )
          )}
          {moments.map((moment) => (
            <button
              key={moment.id}
              type="button"
              onClick={() => pickMoment(moment)}
              className={cn(
                "min-h-9 rounded-full border px-3 py-1.5 text-sm transition-colors",
                moment.id === detail.slot.momentId
                  ? "border-primary bg-primary text-primary-foreground shadow-primary"
                  : "border-transparent bg-card text-muted-foreground hover:bg-accent/40",
              )}
            >
              {moment.label}
            </button>
          ))}
        </div>
      )}

      {detail.type === "logMeal" && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {detail.foods.map((food, index) => (
              <span
                key={`${food.state}-${food.spoken}-${index}`}
                className={cn(
                  "flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm",
                  food.state === "resolved"
                    ? "border-primary/30 bg-primary/10 font-semibold text-primary"
                    : "border-dashed border-novelty/50 bg-novelty-soft/60 text-foreground/80",
                )}
              >
                {food.state === "resolved" && <Check className="size-4" />}
                <FoodLabel food={food} />
                <button
                  type="button"
                  onClick={() => removeFood(index)}
                  aria-label={`Retirer ${food.state === "resolved" ? food.name : food.spoken}`}
                  className="-mr-1.5 grid size-6 place-items-center rounded-full opacity-60 hover:opacity-100"
                >
                  <X className="size-4" />
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => setQuery(query === null ? "" : null)}
              className="flex min-h-10 items-center gap-1 rounded-full border border-dashed px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
            >
              <Plus className="size-4" />
              ajouter
            </button>
          </div>

          {query !== null && (
            <div className="mt-2.5 space-y-2">
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Chercher un aliment"
              />
              {searchResults.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {searchResults.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => addFood(food)}
                      className="min-h-10 rounded-full border bg-card px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40"
                    >
                      {food.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* An unknown name waits for a decision: never a silent write. */}
          {detail.foods.map((food, index) =>
            food.state === "unknown" ? (
              <div
                key={`unknown-${index}`}
                className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3.5 py-2.5 text-sm text-muted-foreground ring-1 ring-border/70"
              >
                <span>
                  <span className="font-semibold text-foreground">
                    {food.spoken}
                  </span>{" "}
                  n'est pas au catalogue.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={creating}
                  onClick={() => createUnknown(food.spoken, index)}
                >
                  {creating && <Loader2 className="size-3.5 animate-spin" />}
                  L'ajouter
                </Button>
              </div>
            ) : null,
          )}

          {detail.appreciation && (
            <p className="mt-2.5">
              <AppreciationChip value={detail.appreciation} />
            </p>
          )}
        </>
      )}

      {detail.type === "rateMeal" && (
        <div className="mt-3 space-y-2">
          <AppreciationChip value={detail.appreciation} />
          {detail.appreciation === "refuse" && (
            <p className="text-sm text-muted-foreground">
              Un refus est normal, il ne décale pas le programme.
            </p>
          )}
        </div>
      )}

      {detail.type === "substituteFood" && (
        <div className="mt-3 space-y-2.5">
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-muted px-3 py-1.5 font-medium text-muted-foreground line-through">
              <FoodLabel food={detail.missing} />
            </span>
            <Repeat aria-hidden className="size-4 text-muted-foreground" />
            {detail.replacement?.state === "resolved" ? (
              <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 font-semibold text-primary">
                {detail.replacement.name}
              </span>
            ) : (
              <span className="text-muted-foreground">à choisir :</span>
            )}
          </p>
          {detail.replacement?.state !== "resolved" &&
            detail.substitutes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detail.substitutes.map((substitute) => (
                  <button
                    key={substitute.id}
                    type="button"
                    onClick={() =>
                      pickSubstitute(substitute.id, substitute.name)
                    }
                    className="min-h-10 rounded-full border bg-card px-3.5 py-1.5 text-sm transition-colors hover:bg-accent/40"
                  >
                    {substitute.name}
                  </button>
                ))}
              </div>
            )}
        </div>
      )}

      {/* What the programme will do, before the parent confirms (§5.3). */}
      {novelties.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-lg border border-novelty/30 bg-novelty-soft px-3.5 py-2.5 text-sm text-foreground/85">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-novelty" />
          <span>
            {novelties.length === 1
              ? `${novelties[0].name}, c'est une première — on le repropose demain.`
              : "Deux nouveautés d'un coup : on les repropose, et en cas de réaction il sera plus difficile de savoir laquelle est en cause."}
          </span>
        </p>
      )}
      {tooYoung.map((food) => (
        <p
          key={food.id}
          className="mt-3 rounded-lg bg-muted px-3.5 py-2.5 text-sm text-muted-foreground"
        >
          {food.name} est habituellement proposé à partir de{" "}
          {food.age_introduction_min} mois. C'est noté quand même.
        </p>
      ))}
      {restricted.map((food) => (
        <p
          key={food.id}
          className="mt-3 flex items-start gap-2 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">{food.name}</span> —{" "}
            {food.restrictions}
          </span>
        </p>
      ))}

      {/* A slot ambiguity already carries its question above the chips:
          repeating it in the footer would make the same sentence read twice. */}
      {block.issue && !block.ready && !detail.slot.momentAmbiguous && (
        <p className="mt-3 text-sm text-muted-foreground">{block.issue}</p>
      )}
    </div>
  );
}
