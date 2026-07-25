"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MealResult } from "@/lib/data/meals.types";

export type LocalObs = { key: string; effect_type: string; severity: string };

const RESULTS: {
  value: Exclude<MealResult, null>;
  label: string;
  emoji: string;
  cls: string;
}[] = [
  {
    value: "bien",
    label: "Adoré",
    emoji: "😋",
    cls: "border-primary/30 bg-primary/12 text-primary",
  },
  {
    value: "moyen",
    label: "Moyen",
    emoji: "😐",
    cls: "border-chart-3/40 bg-chart-3/20 text-amber-700",
  },
  {
    value: "refuse",
    label: "Refusé",
    emoji: "😕",
    cls: "border-destructive/30 bg-destructive/10 text-destructive",
  },
];

const SEVERITIES = ["léger", "modéré", "sévère"];
const SEVERITY_STYLE: Record<string, string> = {
  léger: "border-primary/30 bg-primary/10 text-primary",
  modéré: "border-chart-3/40 bg-chart-3/20 text-amber-700",
  sévère: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function MealEvaluationFields({
  result,
  setResult,
  note,
  setNote,
  observations,
  setObservations,
}: {
  result: MealResult;
  setResult: (r: MealResult) => void;
  note: string;
  setNote: (n: string) => void;
  observations: LocalObs[];
  setObservations: (updater: (prev: LocalObs[]) => LocalObs[]) => void;
}) {
  const [effect, setEffect] = useState("");
  const [severity, setSeverity] = useState(SEVERITIES[0]);

  function addObs() {
    if (!effect.trim()) return;
    setObservations((prev) => [
      ...prev,
      { key: crypto.randomUUID(), effect_type: effect.trim(), severity },
    ]);
    setEffect("");
    setSeverity(SEVERITIES[0]);
  }

  return (
    <>
      <section className="space-y-2">
        <p className="text-sm font-medium">Comment ça s&apos;est passé ?</p>
        <div className="flex flex-wrap gap-2">
          {RESULTS.map((r) => {
            const active = result === r.value;
            return (
              <button
                key={r.value}
                onClick={() => setResult(active ? null : r.value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? r.cls
                    : "border-border text-muted-foreground hover:bg-accent/40",
                )}
              >
                <span>{r.emoji}</span>
                {r.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <AlertTriangle className="size-4 text-destructive" />
          Effet indésirable observé ?
        </p>
        <p className="text-xs text-muted-foreground">
          Rare juste après le repas — mais si tu remarques quelque chose,
          note-le.
        </p>
        {observations.map((o) => (
          <div
            key={o.key}
            className="flex items-center justify-between gap-2 rounded-lg border bg-card p-2.5 text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{o.effect_type}</span>
              <Badge
                variant="outline"
                className={cn("capitalize", SEVERITY_STYLE[o.severity])}
              >
                {o.severity}
              </Badge>
            </div>
            <button
              onClick={() =>
                setObservations((prev) => prev.filter((x) => x.key !== o.key))
              }
              className="text-muted-foreground hover:text-destructive"
              aria-label="Supprimer"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <div className="space-y-2 rounded-lg border border-dashed p-3">
          <Input
            placeholder="Type d'effet (ex. rougeurs, régurgitations…)"
            value={effect}
            onChange={(e) => setEffect(e.target.value)}
          />
          <div className="flex gap-2">
            {SEVERITIES.map((s) => (
              <button
                key={s}
                onClick={() => setSeverity(s)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
                  severity === s
                    ? SEVERITY_STYLE[s]
                    : "text-muted-foreground hover:bg-accent/40",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={!effect.trim()}
            onClick={addObs}
          >
            Ajouter l&apos;effet
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Input
          id="note"
          placeholder="Une remarque sur ce repas…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </section>
    </>
  );
}
