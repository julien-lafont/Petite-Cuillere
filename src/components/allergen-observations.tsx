"use client";

import { useState } from "react";
import { ChevronRight, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MealDetailsDialog } from "@/components/meal-details-dialog";
import type { MealWithDetails } from "@/lib/data/meals.types";

const SEVERITY_STYLE: Record<string, string> = {
  léger: "border-primary/30 bg-primary/10 text-primary",
  modéré: "border-chart-3/40 bg-chart-3/20 text-amber-700",
  sévère: "border-destructive/30 bg-destructive/10 text-destructive",
};

export type ObservationItem = {
  meal: MealWithDetails;
  momentLabel: string;
  dateLabel: string;
};

export function AllergenObservations({ items }: { items: ObservationItem[] }) {
  const [selected, setSelected] = useState<ObservationItem | null>(null);

  const rows = items.flatMap((it) =>
    it.meal.intake_observations.map((o) => ({ it, o })),
  );

  return (
    <>
      <div className="space-y-2">
        {rows.map(({ it, o }) => {
          const allergens = it.meal.meal_allergens
            .map((a) => a.allergen?.name)
            .filter((n): n is string => !!n);
          const foods = it.meal.meal_items
            .map((i) => i.food?.name)
            .filter(Boolean)
            .join(", ");
          return (
            <button
              key={`${it.meal.id}-${o.id}`}
              onClick={() => setSelected(it)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {o.effect_type ?? "Effet"}
                  </span>
                  {o.severity && (
                    <Badge
                      variant="outline"
                      className={cn("capitalize", SEVERITY_STYLE[o.severity])}
                    >
                      {o.severity}
                    </Badge>
                  )}
                </div>
                {allergens.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {allergens.map((name) => (
                      <Badge
                        key={name}
                        variant="outline"
                        className="gap-1 border-chart-3/40 bg-chart-3/15 text-amber-700"
                      >
                        <ShieldAlert className="size-3" />
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {it.dateLabel} · {it.momentLabel}
                  {foods ? ` · ${foods}` : ""}
                </p>
                {o.note && (
                  <p className="truncate text-xs text-muted-foreground">
                    {o.note}
                  </p>
                )}
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {selected && (
        <MealDetailsDialog
          open={!!selected}
          onOpenChange={(v) => !v && setSelected(null)}
          momentLabel={selected.momentLabel}
          dateLabel={selected.dateLabel}
          meal={selected.meal}
        />
      )}
    </>
  );
}
