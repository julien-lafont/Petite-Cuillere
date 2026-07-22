import { ShieldAlert, AlertTriangle, Soup, Scale, Leaf, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { freshnessAdvice, formatSeason } from "@/lib/season";
import { toleranceInfo } from "@/lib/tolerance";
import type { MealWithDetails } from "@/lib/data/meals.types";

const RESULT_META: Record<string, { label: string; cls: string }> = {
  bien: { label: "😋 Bien mangé", cls: "bg-primary/12 text-primary border-primary/20" },
  moyen: { label: "😐 Moyen", cls: "bg-chart-3/20 text-amber-700 border-chart-3/30" },
  refuse: { label: "😕 Refusé", cls: "bg-destructive/10 text-destructive border-destructive/20" },
};

/**
 * Fiche repas détaillée (lecture seule) : pour chaque aliment, tout ce qu'il faut
 * savoir en cuisine — texture, préparation, quantité, restrictions.
 */
export function MealCard({
  momentLabel,
  meal,
  scores,
  introducedIds,
}: {
  momentLabel: string;
  meal: MealWithDetails;
  scores?: Record<string, number>;
  introducedIds?: string[];
}) {
  const result = meal.result ? RESULT_META[meal.result] : null;
  const hasEffect = meal.intake_observations.length > 0;
  const month = Number(meal.date.slice(5, 7)); // mois du repas (1-12)
  const introducedSet = introducedIds ? new Set(introducedIds) : null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
        <p className="font-heading font-bold">{momentLabel}</p>
        <div className="flex items-center gap-2">
          {hasEffect && (
            <span className="flex items-center gap-1 text-xs font-medium text-destructive">
              <AlertTriangle className="size-3.5" />
              Effet
            </span>
          )}
          {result && (
            <Badge variant="outline" className={cn(result.cls)}>
              {result.label}
            </Badge>
          )}
        </div>
      </header>

      <div className="divide-y">
        {meal.meal_items.map((item) => {
          const f = item.food;
          if (!f) return null;
          const advice = f.season ? freshnessAdvice(f.season, month) : null;
          const isNew = introducedSet ? !introducedSet.has(f.id) : false;
          const tol = scores ? toleranceInfo(scores[f.id] ?? null) : null;
          return (
            <div key={item.id} className="space-y-1.5 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading font-bold">{f.name}</p>
                {f.is_allergen && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-chart-3/40 bg-chart-3/15 text-amber-700"
                  >
                    <ShieldAlert className="size-3" />
                    allergène
                  </Badge>
                )}
                {isNew ? (
                  <Badge
                    variant="outline"
                    className="gap-1 border-violet-500/30 bg-violet-500/10 text-violet-700"
                  >
                    🆕 Nouveauté
                  </Badge>
                ) : (
                  tol && (
                    <Badge variant="outline" className={cn("gap-1", tol.cls)}>
                      {tol.emoji} {tol.label}
                    </Badge>
                  )
                )}
              </div>

              {f.texture && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Soup className="size-3.5" />
                  Texture : {f.texture}
                </p>
              )}
              {f.preparation && (
                <p className="text-sm text-foreground/90">{f.preparation}</p>
              )}
              {f.quantite_indicative && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Scale className="size-3.5" />
                  Quantité conseillée : {f.quantite_indicative}
                </p>
              )}
              {f.restrictions && (
                <p className="flex items-start gap-1.5 rounded-lg bg-destructive/8 px-2.5 py-1.5 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  {f.restrictions}
                </p>
              )}
              {advice === "frais" && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Leaf className="size-3.5" />
                  De saison — à acheter frais
                </p>
              )}
              {advice === "surgele" && (
                <p className="flex items-center gap-1.5 text-xs font-medium text-sky-700">
                  <Snowflake className="size-3.5" />
                  Hors saison — surgelé conseillé (saison :{" "}
                  {formatSeason(f.season)})
                </p>
              )}
            </div>
          );
        })}
      </div>

      {meal.meal_allergens.length > 0 && (
        <footer className="flex flex-wrap items-center gap-1.5 border-t bg-muted/20 px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            Allergènes :
          </span>
          {meal.meal_allergens.map((a) => (
            <Badge
              key={a.id}
              variant="outline"
              className="border-chart-3/40 bg-chart-3/15 text-amber-700"
            >
              {a.allergen?.name ?? "?"}
            </Badge>
          ))}
        </footer>
      )}

      {meal.note && (
        <p className="border-t px-4 py-2.5 text-sm text-muted-foreground">
          📝 {meal.note}
        </p>
      )}
    </div>
  );
}
