"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  addMealMoment,
  removeMealMoment,
  updateMealMoment,
  type MomentActionResult,
} from "@/lib/data/meal-moments.actions";
import { firstFreeWindow, windowIssue } from "@/lib/moments";
import type { MealMoment } from "@/lib/data/meal-moments";

/**
 * Les moments de repas du foyer — écran caché derrière `FEATURE_CUSTOM_MEALS`.
 *
 * Depuis que chaque moment porte un créneau (docs/feats/creneaux-horaires.md),
 * les flèches « monter / descendre » ont disparu : l'ordre de la journée est
 * celui des heures, et deux ordres qui peuvent se contredire sont un ordre de
 * trop. Une ligne se déplace en changeant son heure.
 *
 * Le champ `type="time"` fait le reste du travail : clavier numérique au
 * téléphone, roue horaire, format local. Il rend « HH:MM », qu'on convertit en
 * minutes — la seule unité que le reste du produit connaisse.
 */

function toMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function toTimeValue(minutes: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  // 24 h 00 n'existe pas pour `type="time"` : la fin de journée s'écrit 23:59.
  const clamped = Math.min(minutes, 1439);
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

function MomentRow({
  moment,
  others,
  isPending,
  run,
}: {
  moment: MealMoment;
  others: MealMoment[];
  isPending: boolean;
  run: (fn: () => Promise<MomentActionResult>) => void;
}) {
  const [label, setLabel] = useState(moment.label);
  const [start, setStart] = useState(toTimeValue(moment.startMinute));
  const [end, setEnd] = useState(toTimeValue(moment.endMinute));

  const startMinute = toMinutes(start);
  const endMinute = toMinutes(end);
  const issue =
    startMinute === null || endMinute === null
      ? "Horaire incomplet."
      : windowIssue({ startMinute, endMinute }, others);

  const changed =
    label !== moment.label ||
    startMinute !== moment.startMinute ||
    endMinute !== moment.endMinute;

  /** On n'enregistre qu'un état valide ; sinon la ligne garde sa saisie et dit pourquoi. */
  function commit() {
    if (!changed || issue || startMinute === null || endMinute === null) return;
    run(() =>
      updateMealMoment(moment.id, label.trim(), startMinute, endMinute),
    );
  }

  return (
    <div className="rounded-lg border bg-card p-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          className="h-9 min-w-40 flex-1"
          aria-label="Nom du moment"
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            onBlur={commit}
            className="h-9 w-28"
            aria-label={`Début de ${moment.label}`}
          />
          <span aria-hidden className="text-muted-foreground">
            –
          </span>
          <Input
            type="time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            onBlur={commit}
            className="h-9 w-28"
            aria-label={`Fin de ${moment.label}`}
          />
        </div>
        <button
          disabled={isPending}
          onClick={() => run(() => removeMealMoment(moment.id))}
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Supprimer ${moment.label}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {changed && issue && (
        <p className="mt-1.5 flex items-start gap-1.5 px-1 text-xs text-destructive">
          <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
          {issue}
        </p>
      )}
    </div>
  );
}

export function MealMomentsManager({ moments }: { moments: MealMoment[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // La création propose le premier trou libre plutôt que deux champs vides :
  // neuf fois sur dix c'est le bon créneau, et dans tous les cas c'est un
  // exemple de ce qu'on attend.
  const suggestion = firstFreeWindow(moments);
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState(
    toTimeValue(suggestion?.startMinute ?? 10 * 60),
  );
  const [newEnd, setNewEnd] = useState(
    toTimeValue(suggestion?.endMinute ?? 11 * 60),
  );

  function run(fn: () => Promise<MomentActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result?.error) setError(result.error);
      else router.refresh();
    });
  }

  const newStartMinute = toMinutes(newStart);
  const newEndMinute = toMinutes(newEnd);
  const canAdd =
    newLabel.trim().length > 0 &&
    newStartMinute !== null &&
    newEndMinute !== null &&
    !windowIssue(
      { startMinute: newStartMinute, endMinute: newEndMinute },
      moments,
    );

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Chaque moment occupe un créneau. Ils ne peuvent pas se chevaucher, mais
        la journée n'a pas à être couverte entièrement.
      </p>

      {moments.map((m) => (
        <MomentRow
          key={m.id}
          moment={m}
          others={moments.filter((other) => other.id !== m.id)}
          isPending={isPending}
          run={run}
        />
      ))}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Input
          placeholder="Nouveau moment (ex. Collation)"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="h-9 min-w-40 flex-1"
        />
        <div className="flex items-center gap-1.5">
          <Input
            type="time"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            className="h-9 w-28"
            aria-label="Début du nouveau moment"
          />
          <span aria-hidden className="text-muted-foreground">
            –
          </span>
          <Input
            type="time"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            className="h-9 w-28"
            aria-label="Fin du nouveau moment"
          />
        </div>
        <Button
          variant="secondary"
          disabled={isPending || !canAdd}
          onClick={() =>
            run(async () => {
              const result = await addMealMoment(
                newLabel,
                newStartMinute!,
                newEndMinute!,
              );
              if (!result.error) setNewLabel("");
              return result;
            })
          }
        >
          <Plus className="size-4" />
          Ajouter
        </Button>
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-sm text-destructive">
          <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
