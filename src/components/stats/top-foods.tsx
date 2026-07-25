import { ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toleranceInfo } from "@/lib/tolerance";
import { categoryMeta } from "@/lib/categories";
import type { FoodScoreRow } from "@/lib/stats";

function FoodScoreList({
  rows,
  emptyLabel,
}: {
  rows: FoodScoreRow[];
  emptyLabel: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => {
        const tol = toleranceInfo(r.score);
        const meta = categoryMeta(r.category);
        return (
          <li
            key={r.foodId}
            className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-1.5 font-medium">
              {meta.emoji} {r.name}
              {r.isAllergen && (
                <ShieldAlert className="size-3 text-amber-600" />
              )}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {r.exposures}×
              {tol && (
                <Badge variant="outline" className={cn("gap-1", tol.cls)}>
                  {tol.emoji} {r.score}%
                </Badge>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function TopFoods({
  best,
  hardest,
}: {
  best: FoodScoreRow[];
  hardest: FoodScoreRow[];
}) {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <span>😋</span> Chouchous
        </h3>
        <FoodScoreList
          rows={best}
          emptyLabel="Pas encore assez de repas notés."
        />
      </div>
      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <span>😕</span> Plus difficiles
        </h3>
        <FoodScoreList
          rows={hardest}
          emptyLabel="Pas encore assez de repas notés."
        />
      </div>
    </div>
  );
}
