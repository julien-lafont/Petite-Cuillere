"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Clock, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { setMealResult } from "@/lib/data/meals.actions";
import { refusalReassurance } from "@/lib/program/diff";
import type { MealResult, MealStatus } from "@/lib/data/meals.types";
import type { Phase } from "@/lib/moments";

/**
 * A meal collapsed onto one row — the day thread's building block.
 *
 * A meal card is a cooking document: composition, quantities, steps,
 * replacements. Past the meal's hour it has nothing left to say, and yet it took
 * its full height until evening, between breakfast and the snack. A meal that
 * has been answered therefore folds away here, recipe and all, and the day
 * becomes readable at a glance again.
 *
 * The state reads as a shape before it reads as a word: a filled, ticked badge
 * for a meal eaten, an empty badge and a struck-through menu for a skipped one,
 * a dotted outline and a clock face for an upcoming one. A parent scanning the
 * page does not have to read to know where they are.
 *
 * Whatever has had its hour — eaten, skipped, or left unanswered — carries the
 * unfolded card's background: those rows tell the real day, and belong to the
 * same plane as it. Only the upcoming meal stays an outline on the page
 * background: it has nothing to tell yet. The grey they all used to carry put
 * them in the background, this midday's meal as much as tonight's.
 *
 * The meal's rank in the day ("1", "2"…) gave way to its window: "11 h – 14 h"
 * says everything the number said, and more. The current moment carries a "now"
 * marker — it is the only row the parent looks for when they open the app
 * (docs/feats/creneaux-horaires.md §6.1).
 *
 * ── The rating ─────────────────────────────────────────────────────────────
 * Here, and only here, we ask whether the meal went down well: afterwards, once
 * it is settled that it happened. Three chips while nothing is chosen, then the
 * single chosen face — a closed row must not look like a form. Changing it is a
 * matter of tapping that face.
 *
 * Deliberately free of any notion of streak, score or completion: an unrated
 * meal simply stays unrated (scoping decision D8).
 */
const FACES: {
  value: Exclude<MealResult, null>;
  emoji: string;
  label: string;
  activeCls: string;
}[] = [
  {
    value: "bien",
    emoji: "😋",
    label: "Adoré",
    activeCls: "border-primary bg-secondary",
  },
  {
    value: "moyen",
    emoji: "😐",
    label: "Moyen",
    activeCls: "border-chart-3 bg-chart-3/20",
  },
  {
    value: "refuse",
    emoji: "🙅",
    label: "Refusé",
    activeCls: "border-destructive bg-destructive/10",
  },
];

/** What the row says about itself, beyond the moment. */
function suffixFor(status: MealStatus, phase: Phase): string {
  if (status === "saute") return " · repas sauté";
  if (status === "remplace") return " · menu changé";
  // A meal whose time has passed and that nobody said anything about: the
  // catch-up strip already asks for it above, the row just says so.
  if (status === "prevu" && phase === "past") return " · à renseigner";
  return "";
}

export function MealSummaryRow({
  babyId,
  date,
  momentId,
  momentLabel,
  summary,
  status,
  result,
  window,
  phase,
  noveltyName = null,
  badge,
  onOpen,
}: {
  babyId: string;
  date: string;
  momentId: string;
  momentLabel: string;
  /** The menu on one line — what you recognise without unfolding. */
  summary: string;
  status: MealStatus;
  result: MealResult;
  /** The moment's window, "11 h – 14 h". */
  window: string;
  /** Past, current or upcoming — on household time. */
  phase: Phase;
  /** Name of the day's discovery — feeds the message that follows a refusal. */
  noveltyName?: string | null;
  /** Chip placed to the right of the title (something new, for instance). */
  badge?: React.ReactNode;
  onOpen: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState<MealResult>(result);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // With no answer from the parent there is nothing to rate: we do not ask how a
  // meal went when we do not yet know whether it happened.
  const unanswered = status === "prevu";
  const skipped = status === "saute";
  const rateable = !unanswered && !skipped;
  // The meal has not had its slot yet — the only case where the row stays a
  // dotted outline on the page background.
  const upcoming = unanswered && phase === "future";

  function choose(next: Exclude<MealResult, null>) {
    const resolved = value === next ? null : next; // tapping again = deselect
    setValue(resolved);
    setEditing(false);
    // A refusal shifts nothing (decision G): there is nothing to replan, but
    // this is where the parent doubts — and the app used to say nothing.
    setMessage(resolved === "refuse" ? refusalReassurance(noveltyName) : null);
    startTransition(async () => {
      await setMealResult(babyId, date, momentId, resolved);
      router.refresh();
    });
  }

  const chosen = FACES.find((f) => f.value === value);

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border px-3.5 py-3",
          upcoming ? "border-dashed" : "bg-card shadow-soft",
        )}
      >
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Ouvrir le détail du repas : ${momentLabel}`}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            aria-hidden
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums",
              unanswered || skipped
                ? "border-[1.5px] border-border text-muted-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {unanswered ? (
              <Clock className="size-4" />
            ) : skipped ? (
              <Minus className="size-4" />
            ) : (
              <Check className="size-4" />
            )}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-heading font-semibold">
                {momentLabel}
                <span className="font-normal text-muted-foreground">
                  {suffixFor(status, phase)}
                </span>
              </span>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {window}
              </span>
              {phase === "current" && (
                <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[0.6875rem] font-semibold text-secondary-foreground">
                  maintenant
                </span>
              )}
              {badge}
            </span>
            {/* A skipped meal's menu is struck through: the eye sees "this did
                not happen" before reading the word. */}
            <span
              className={cn(
                "block truncate text-sm text-muted-foreground",
                skipped && "line-through",
              )}
            >
              {summary}
            </span>
          </span>
        </button>

        {rateable ? (
          chosen && !editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`${momentLabel} : ${chosen.label} — modifier`}
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-full border-[1.5px] text-lg leading-none",
                chosen.activeCls,
              )}
            >
              {chosen.emoji}
            </button>
          ) : (
            <div className="flex shrink-0 gap-1.5">
              {FACES.map((face) => (
                <button
                  key={face.value}
                  type="button"
                  aria-pressed={value === face.value}
                  onClick={() => choose(face.value)}
                  aria-label={face.label}
                  title={face.label}
                  className={cn(
                    "grid size-9 place-items-center rounded-full border-[1.5px] text-lg leading-none transition-colors",
                    value === face.value
                      ? face.activeCls
                      : "border-border bg-card hover:border-foreground/25",
                  )}
                >
                  {face.emoji}
                </button>
              ))}
            </div>
          )
        ) : (
          <ChevronRight
            aria-hidden
            className="size-5 shrink-0 text-muted-foreground"
          />
        )}
      </div>

      {message && (
        <p className="rounded-md bg-accent px-3.5 py-2.5 text-sm text-accent-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
