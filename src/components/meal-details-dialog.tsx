"use client";

import { ShieldAlert, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MealWithDetails } from "@/lib/data/meals.types";

const RESULT_META: Record<string, { label: string; cls: string }> = {
  bien: { label: "😋 Adoré", cls: "bg-primary/12 text-primary border-primary/20" },
  moyen: { label: "😐 Moyen", cls: "bg-chart-3/20 text-amber-700 border-chart-3/30" },
  refuse: { label: "😕 Refusé", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};
const SEVERITY_STYLE: Record<string, string> = {
  léger: "border-primary/30 bg-primary/10 text-primary",
  modéré: "border-chart-3/40 bg-chart-3/20 text-amber-700",
  sévère: "border-destructive/30 bg-destructive/10 text-destructive",
};

/** Fiche d'un repas en lecture seule (pas d'édition). */
export function MealDetailsDialog({
  open,
  onOpenChange,
  momentLabel,
  dateLabel,
  meal,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  momentLabel: string;
  dateLabel: string;
  meal: MealWithDetails;
}) {
  const result = meal.result ? RESULT_META[meal.result] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {momentLabel}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {dateLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          {result && (
            <div>
              <p className="mb-1 font-medium">Résultat</p>
              <Badge variant="outline" className={cn(result.cls)}>
                {result.label}
              </Badge>
            </div>
          )}

          <div>
            <p className="mb-1 font-medium">Aliments</p>
            <div className="flex flex-wrap gap-1.5">
              {meal.meal_items.length ? (
                meal.meal_items.map((i) => (
                  <Badge key={i.id} variant="secondary" className="font-normal">
                    {i.food?.name ?? "?"}
                  </Badge>
                ))
              ) : (
                <span className="text-muted-foreground">Aucun</span>
              )}
            </div>
          </div>

          {meal.meal_allergens.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-medium">
                <ShieldAlert className="size-4 text-amber-600" />
                Allergènes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {meal.meal_allergens.map((a) => (
                  <Badge
                    key={a.id}
                    variant="outline"
                    className="border-chart-3/40 bg-chart-3/15 text-amber-700"
                  >
                    {a.allergen?.name ?? "?"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {meal.intake_observations.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="size-4 text-destructive" />
                Effets indésirables
              </p>
              <div className="space-y-1.5">
                {meal.intake_observations.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-2 rounded-lg border bg-card p-2.5"
                  >
                    <span className="font-medium">{o.effect_type}</span>
                    {o.severity && (
                      <Badge
                        variant="outline"
                        className={cn("capitalize", SEVERITY_STYLE[o.severity])}
                      >
                        {o.severity}
                      </Badge>
                    )}
                    {o.note && (
                      <span className="text-xs text-muted-foreground">{o.note}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {meal.note && (
            <div>
              <p className="mb-1 font-medium">Note</p>
              <p className="text-muted-foreground">{meal.note}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
