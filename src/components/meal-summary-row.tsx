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
 * Un repas replié sur une ligne — la brique du fil du jour.
 *
 * Une fiche repas est un document de cuisine : composition, quantités,
 * pas-à-pas, remplacements. Passé l'heure du repas, elle n'a plus rien à dire,
 * et elle occupait pourtant toute sa hauteur jusqu'au soir, entre le
 * petit-déjeuner et le goûter. Un repas renseigné se range donc ici, sa
 * recette avec lui, et la journée redevient lisible d'un coup d'œil.
 *
 * L'état se lit à la forme avant de se lire au mot : pastille pleine et cochée
 * pour un repas pris, pastille vide et menu barré pour un repas sauté, contour
 * en pointillés et cadran pour un repas à venir. Un parent qui balaie la page
 * n'a pas à lire pour savoir où il en est.
 *
 * Le rang du repas dans la journée (« 1 », « 2 »…) a cédé la place à son
 * créneau : « 11 h – 14 h » dit tout ce que le numéro disait, et le reste
 * en plus. Le moment en cours porte un marqueur « maintenant » — c'est la seule
 * ligne que le parent cherche quand il ouvre l'application
 * (docs/feats/creneaux-horaires.md §6.1).
 *
 * ── L'appréciation ─────────────────────────────────────────────────────────
 * C'est ici, et seulement ici, qu'on demande si le repas a plu : après coup,
 * une fois qu'il est acquis qu'il a eu lieu. Trois pastilles tant que rien
 * n'est choisi, puis le seul visage retenu — une ligne close ne doit pas
 * ressembler à un formulaire. La retoucher se fait en tapant ce visage.
 *
 * Volontairement dénué de toute notion de série, de score ou de complétion :
 * un repas non noté reste simplement non noté (décision de cadrage D8).
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

/** Ce que la ligne dit d'elle-même, en plus du moment. */
function suffixFor(status: MealStatus, phase: Phase): string {
  if (status === "saute") return " · repas sauté";
  if (status === "remplace") return " · menu changé";
  // Un repas dont l'heure est passée et dont personne n'a rien dit : la bande de
  // rattrapage le réclame déjà en haut, la ligne se contente de le dire.
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
  /** Le menu en une ligne — ce qu'on reconnaît sans déplier. */
  summary: string;
  status: MealStatus;
  result: MealResult;
  /** Le créneau du moment, « 11 h – 14 h ». */
  window: string;
  /** Passé, en cours ou à venir — à l'heure du foyer. */
  phase: Phase;
  /** Nom de la découverte du jour — sert le message qui suit un refus. */
  noveltyName?: string | null;
  /** Pastille posée à droite du titre (une nouveauté, par exemple). */
  badge?: React.ReactNode;
  onOpen: () => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState<MealResult>(result);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ahead = status === "prevu";
  const skipped = status === "saute";
  const rateable = !ahead && !skipped;

  function choose(next: Exclude<MealResult, null>) {
    const resolved = value === next ? null : next; // retaper = désélectionner
    setValue(resolved);
    setEditing(false);
    // Un refus ne décale rien (décision G) : il n'y a rien à replanifier, mais
    // c'est ici que le parent doute — et l'app se taisait.
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
          ahead ? "border-dashed" : "bg-muted",
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
              ahead || skipped
                ? "border-[1.5px] border-border bg-card text-muted-foreground"
                : "bg-primary text-primary-foreground",
            )}
          >
            {ahead ? (
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
            {/* Le menu d'un repas sauté est barré : l'œil voit « ça n'a pas eu
                lieu » avant d'avoir lu le mot. */}
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
