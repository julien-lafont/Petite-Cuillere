"use client";

import { useTransition } from "react";
import { Check, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { IntroductionCounts } from "@/lib/data/meals.types";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";
import { getIntroductionCounts } from "@/lib/data/meals.actions";
import { ageMonthsAtDate } from "@/lib/food-eligibility";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/categories";

export function MealFoodPicker({
  babyId,
  date,
  foods,
  allergens,
  birthDate,
  dueDate,
  ageReferenceDate,
  foodIds,
  setFoodIds,
  allergenIds,
  setAllergenIds,
  showAll,
  setShowAll,
  showCounts,
  setShowCounts,
  counts,
  setCounts,
}: {
  babyId: string;
  date: string;
  foods: FoodRow[];
  allergens: AllergenRow[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
  foodIds: Set<string>;
  setFoodIds: (updater: (prev: Set<string>) => Set<string>) => void;
  allergenIds: Set<string>;
  setAllergenIds: (updater: (prev: Set<string>) => Set<string>) => void;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
  showCounts: boolean;
  setShowCounts: (v: boolean) => void;
  counts: IntroductionCounts | null;
  setCounts: (c: IntroductionCounts) => void;
}) {
  const [countsPending, startCounts] = useTransition();

  function toggleCounts(v: boolean) {
    setShowCounts(v);
    if (v && !counts)
      startCounts(async () => setCounts(await getIntroductionCounts(babyId, date)));
  }

  const ageMonths = ageMonthsAtDate(date, birthDate, dueDate, ageReferenceDate);

  const allergenMinAge = new Map<string, number>();
  for (const a of allergens) {
    const carriers = foods.filter(
      (f) =>
        f.is_allergen &&
        f.allergen_type?.trim().toLowerCase() === a.name.trim().toLowerCase() &&
        f.age_introduction_min != null,
    );
    allergenMinAge.set(
      a.id,
      carriers.length ? Math.min(...carriers.map((f) => f.age_introduction_min!)) : 4,
    );
  }

  function toggleFood(f: FoodRow) {
    setFoodIds((prev) => {
      const next = new Set(prev);
      if (next.has(f.id)) {
        next.delete(f.id);
      } else {
        next.add(f.id);
        // auto-ajout de l'allergène associé
        if (f.is_allergen && f.allergen_type) {
          const match = allergens.find(
            (a) => a.name.trim().toLowerCase() === f.allergen_type!.trim().toLowerCase(),
          );
          if (match) setAllergenIds((p) => new Set(p).add(match.id));
        }
      }
      return next;
    });
  }

  function toggleAllergen(id: string) {
    setAllergenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Aliments visibles : éligibles à l'âge (ou tout), + ceux déjà sélectionnés
  const visibleFoods = foods.filter(
    (f) =>
      foodIds.has(f.id) || showAll || (f.age_introduction_min ?? 0) <= ageMonths,
  );
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    meta: categoryMeta(cat),
    items: visibleFoods.filter((f) => (f.category ?? "autre") === cat),
  })).filter((g) => g.items.length > 0);

  const visibleAllergens = allergens.filter(
    (a) =>
      allergenIds.has(a.id) ||
      showAll ||
      (allergenMinAge.get(a.id) ?? 0) <= ageMonths,
  );

  const CountBadge = ({ n }: { n: number }) =>
    showCounts ? (
      <span className="ml-1 text-[10px] font-semibold opacity-70">
        {countsPending ? "…" : `${n}×`}
      </span>
    ) : null;

  return (
    <>
      {/* Options */}
      <div className="space-y-2 rounded-lg border p-2.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="show-all" className="cursor-pointer text-sm">
            Tous les aliments{" "}
            <span className="text-muted-foreground">(sans limite d&apos;âge)</span>
          </Label>
          <Switch id="show-all" checked={showAll} onCheckedChange={setShowAll} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="show-counts" className="cursor-pointer text-sm">
            Nombre d&apos;introductions
          </Label>
          <Switch
            id="show-counts"
            checked={showCounts}
            onCheckedChange={toggleCounts}
          />
        </div>
      </div>

      {/* Aliments — puces groupées par catégorie */}
      <section className="space-y-3">
        <p className="text-sm font-medium">Aliments</p>
        {grouped.map((g) => (
          <div key={g.cat} className="space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground">
              {g.meta.emoji} {g.meta.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {g.items.map((f) => {
                const selected = foodIds.has(f.id);
                return (
                  <button
                    key={f.id}
                    onClick={() => toggleFood(f)}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent/40",
                    )}
                  >
                    {selected && <Check className="size-3" />}
                    {f.name}
                    {f.is_allergen && (
                      <ShieldAlert className="size-3 text-amber-600" />
                    )}
                    <CountBadge n={counts?.foods[f.id] ?? 0} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Allergènes */}
      <section className="space-y-1.5">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ShieldAlert className="size-4 text-amber-600" />
          Allergènes introduits
        </p>
        <div className="flex flex-wrap gap-1.5">
          {visibleAllergens.map((a) => {
            const selected = allergenIds.has(a.id);
            return (
              <button
                key={a.id}
                onClick={() => toggleAllergen(a.id)}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  selected
                    ? "border-chart-3/50 bg-chart-3/20 text-amber-700"
                    : "text-muted-foreground hover:bg-accent/40",
                )}
              >
                {selected && <Check className="size-3" />}
                {a.name}
                <CountBadge n={counts?.allergens[a.id] ?? 0} />
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}
