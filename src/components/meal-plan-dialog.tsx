"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldAlert, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { MealWithDetails, IntroductionCounts } from "@/lib/data/meals.types";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";
import { saveMeal, getIntroductionCounts } from "@/lib/data/meals.actions";
import { resolveReferenceDate, ageBetween } from "@/lib/age";

const CATEGORY_META: Record<string, { label: string; emoji: string }> = {
  légume: { label: "Légumes", emoji: "🥕" },
  fruit: { label: "Fruits", emoji: "🍎" },
  protéine: { label: "Protéines", emoji: "🍗" },
  laitier: { label: "Produits laitiers", emoji: "🧀" },
  féculent: { label: "Féculents", emoji: "🌾" },
  "matière grasse": { label: "Matières grasses", emoji: "🫒" },
  autre: { label: "Autres", emoji: "🥄" },
};
const CATEGORY_ORDER = Object.keys(CATEGORY_META);

export function MealPlanDialog({
  open,
  onOpenChange,
  babyId,
  date,
  momentId,
  momentLabel,
  dateLabel,
  meal,
  foods,
  allergens,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  babyId: string;
  date: string;
  momentId: string;
  momentLabel: string;
  dateLabel: string;
  meal: MealWithDetails | null;
  foods: FoodRow[];
  allergens: AllergenRow[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [foodIds, setFoodIds] = useState<Set<string>>(new Set());
  const [allergenIds, setAllergenIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [showCounts, setShowCounts] = useState(false);
  const [counts, setCounts] = useState<IntroductionCounts | null>(null);
  const [countsPending, startCounts] = useTransition();
  const initialRef = useRef("");

  useEffect(() => {
    if (!open) return;
    const f = new Set(
      (meal?.meal_items ?? []).map((i) => i.food?.id).filter((x): x is string => !!x),
    );
    const a = new Set(
      (meal?.meal_allergens ?? [])
        .map((x) => x.allergen?.id)
        .filter((x): x is string => !!x),
    );
    setFoodIds(f);
    setAllergenIds(a);
    initialRef.current = JSON.stringify([[...f].sort(), [...a].sort()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, momentId]);

  function toggleCounts(v: boolean) {
    setShowCounts(v);
    if (v && !counts)
      startCounts(async () => setCounts(await getIntroductionCounts(babyId, date)));
  }

  const ageMonths = ageBetween(
    resolveReferenceDate(
      new Date(birthDate),
      dueDate ? new Date(dueDate) : null,
      ageReferenceDate ? new Date(ageReferenceDate) : null,
    ),
    new Date(`${date}T00:00:00`),
  ).months;

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

  const dirty =
    JSON.stringify([[...foodIds].sort(), [...allergenIds].sort()]) !==
    initialRef.current;

  function save() {
    startTransition(async () => {
      await saveMeal(babyId, date, momentId, {
        result: meal?.result ?? null,
        note: meal?.note ?? "",
        foodIds: [...foodIds],
        allergenIds: [...allergenIds],
        observations: (meal?.intake_observations ?? []).map((o) => ({
          effect_type: o.effect_type ?? "",
          severity: o.severity ?? "léger",
          note: o.note ?? "",
        })),
      });
      router.refresh();
      onOpenChange(false);
    });
  }

  // Aliments visibles : éligibles à l'âge (ou tout), + ceux déjà sélectionnés
  const visibleFoods = foods.filter(
    (f) =>
      foodIds.has(f.id) || showAll || (f.age_introduction_min ?? 0) <= ageMonths,
  );
  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    meta: CATEGORY_META[cat],
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {momentLabel}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {dateLabel}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto">
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
        </div>

        <DialogFooter className="flex-row items-center justify-between border-t pt-4 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {foodIds.size} aliment{foodIds.size > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button onClick={save} disabled={isPending || !dirty}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
