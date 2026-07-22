"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Trash2, Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MealWithDetails, MealResult } from "@/lib/data/meals.types";
import { saveMeal } from "@/lib/data/meals.actions";

type LocalObs = { key: string; effect_type: string; severity: string };

const RESULTS: { value: Exclude<MealResult, null>; label: string; emoji: string; cls: string }[] = [
  { value: "bien", label: "Bien mangé", emoji: "😋", cls: "border-primary/30 bg-primary/12 text-primary" },
  { value: "moyen", label: "Moyen", emoji: "😐", cls: "border-chart-3/40 bg-chart-3/20 text-amber-700" },
  { value: "refuse", label: "Refusé", emoji: "😕", cls: "border-destructive/30 bg-destructive/10 text-destructive" },
];

const SEVERITIES = ["léger", "modéré", "sévère"];
const SEVERITY_STYLE: Record<string, string> = {
  léger: "border-primary/30 bg-primary/10 text-primary",
  modéré: "border-chart-3/40 bg-chart-3/20 text-amber-700",
  sévère: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function MealEvaluateDialog({
  open,
  onOpenChange,
  babyId,
  date,
  momentId,
  momentLabel,
  dateLabel,
  meal,
  onEditFoods,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  babyId: string;
  date: string;
  momentId: string;
  momentLabel: string;
  dateLabel: string;
  meal: MealWithDetails | null;
  onEditFoods?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<MealResult>(null);
  const [note, setNote] = useState("");
  const [observations, setObservations] = useState<LocalObs[]>([]);
  const [effect, setEffect] = useState("");
  const [severity, setSeverity] = useState(SEVERITIES[0]);

  useEffect(() => {
    if (!open) return;
    setResult(meal?.result ?? null);
    setNote(meal?.note ?? "");
    setObservations(
      (meal?.intake_observations ?? []).map((o) => ({
        key: o.id,
        effect_type: o.effect_type ?? "",
        severity: o.severity ?? "léger",
      })),
    );
    setEffect("");
    setSeverity(SEVERITIES[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, momentId]);

  function addObs() {
    if (!effect.trim()) return;
    setObservations((prev) => [
      ...prev,
      { key: crypto.randomUUID(), effect_type: effect.trim(), severity },
    ]);
    setEffect("");
    setSeverity(SEVERITIES[0]);
  }

  function save() {
    startTransition(async () => {
      await saveMeal(babyId, date, momentId, {
        result,
        note,
        // aliments/allergènes préservés tels quels
        foodIds: (meal?.meal_items ?? [])
          .map((i) => i.food?.id)
          .filter((x): x is string => !!x),
        allergenIds: (meal?.meal_allergens ?? [])
          .map((a) => a.allergen?.id)
          .filter((x): x is string => !!x),
        observations: observations.map((o) => ({
          effect_type: o.effect_type,
          severity: o.severity,
          note: "",
        })),
      });
      router.refresh();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            Évaluer — {momentLabel}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {dateLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto">
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

          {onEditFoods && (
            <button
              onClick={onEditFoods}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <Pencil className="size-3.5" />
              Modifier les aliments du repas
            </button>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button onClick={save} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Enregistrer l&apos;évaluation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
