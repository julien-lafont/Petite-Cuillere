"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Search, AlertTriangle, Ban } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { logMealFoods, setMealSkipped } from "@/lib/data/meal-reality.actions";
import { ageMonthsAtDate } from "@/lib/food-eligibility";
import type { MealWithDetails } from "@/lib/data/meals.types";
import type { FoodRow } from "@/lib/data/foods";

/**
 * « Qu'est-ce qu'il a mangé ? » — la feuille de correction du réel.
 *
 * Trois zones, aucun défilement infini, aucun champ obligatoire (cf.
 * docs/feats/suivi-reel-et-rattrapage.md §4.3) :
 *
 *   1. « Rien / on a sauté ce repas » — la sortie la plus rapide, en tête ;
 *   2. ce qui était prévu, déjà coché — le cas « la carotte PLUS un yaourt »
 *      se règle alors en un seul tap, sans tout ressaisir ;
 *   3. ce qu'il connaît déjà, puis le catalogue entier par la recherche.
 *
 * On prévient, on ne bloque jamais : un aliment hors âge ou hors ordre affiche
 * un message factuel, et le bouton reste actif. Refuser un enregistrement,
 * c'est perdre le parent pour de bon.
 */
export function MealRealitySheet({
  open,
  onOpenChange,
  babyId,
  date,
  momentLabel,
  dateLabel,
  momentId,
  meal,
  foods,
  introducedIds,
  birthDate,
  dueDate,
  ageReferenceDate,
  onDone,
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
  /** Aliments déjà connus de l'enfant — proposés en premier. */
  introducedIds: string[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
  /** Remonte la phrase de retour (« le brocoli sera reproposé demain »). */
  onDone?: (sentence: string | null) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Pré-cochée sur ce qui était prévu : le cas « la carotte PLUS un yaourt » se
  // règle alors en un tap. L'état se réinitialise par démontage — les appelants
  // posent une `key` sur le créneau visé, ce qui évite un effet de resynchro.
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        (meal?.meal_items ?? [])
          .map((it) => it.food?.id)
          .filter((id): id is string => !!id),
      ),
  );
  const [query, setQuery] = useState("");

  const plannedIds = useMemo(
    () =>
      (meal?.meal_items ?? [])
        .map((it) => it.food?.id)
        .filter((id): id is string => !!id),
    [meal],
  );

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const introducedSet = useMemo(() => new Set(introducedIds), [introducedIds]);
  const ageMonths = ageMonthsAtDate(date, birthDate, dueDate, ageReferenceDate);

  // Les aliments proposés d'emblée : ceux qu'il connaît déjà, les plus
  // plausibles en premier. La recherche ouvre le catalogue entier.
  const suggestions = useMemo(() => {
    const known = foods.filter(
      (f) => introducedSet.has(f.id) && !plannedIds.includes(f.id),
    );
    const plannedCats = new Set(
      plannedIds.map((id) => foodById.get(id)?.category).filter(Boolean),
    );
    return known
      .sort(
        (a, b) =>
          Number(plannedCats.has(b.category)) -
            Number(plannedCats.has(a.category)) ||
          a.name.localeCompare(b.name, "fr"),
      )
      .slice(0, 12);
  }, [foods, introducedSet, plannedIds, foodById]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return foods.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 20);
  }, [foods, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Avertissements — informatifs, jamais bloquants.
  const chosen = [...selected].map((id) => foodById.get(id)).filter(Boolean);
  const novelties = chosen.filter((f) => f && !introducedSet.has(f.id));
  const tooYoung = chosen.filter(
    (f) => f && (f.age_introduction_min ?? 0) > ageMonths,
  );
  const restricted = chosen.filter((f) => f?.restrictions);

  function save() {
    startTransition(async () => {
      const res = await logMealFoods(babyId, date, momentId, [...selected]);
      router.refresh();
      onDone?.(res.sentence);
      onOpenChange(false);
    });
  }

  function skip() {
    startTransition(async () => {
      const res = await setMealSkipped(babyId, date, momentId, true);
      router.refresh();
      onDone?.(res.sentence);
      onOpenChange(false);
    });
  }

  const Pill = ({ f, muted }: { f: FoodRow; muted?: boolean }) => {
    const isOn = selected.has(f.id);
    return (
      <button
        type="button"
        onClick={() => toggle(f.id)}
        className={cn(
          "flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors",
          isOn
            ? "border-primary bg-primary/10 font-medium text-primary"
            : muted
              ? "text-muted-foreground hover:bg-accent/40"
              : "hover:bg-accent/40",
        )}
      >
        {isOn && <Check className="size-3.5" />}
        {f.name}
      </button>
    );
  };

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
          {/* La sortie la plus rapide, en tête. */}
          <button
            type="button"
            onClick={skip}
            disabled={isPending}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg border border-dashed text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <Ban className="size-4" />
            Rien — on a sauté ce repas
          </button>

          {plannedIds.length > 0 && (
            <section className="space-y-2">
              {/* Après une première correction, ces pastilles ne sont plus le
                  programme mais ce que le parent a déjà déclaré : le titre doit
                  le dire, sinon l'écran ment sur sa propre histoire. */}
              <p className="text-sm font-medium">
                {meal && meal.status !== "prevu"
                  ? "Ce qu'il a mangé"
                  : "Ce qui était prévu"}
              </p>
              <div className="flex flex-wrap gap-2">
                {plannedIds.map((id) => {
                  const f = foodById.get(id);
                  return f ? <Pill key={id} f={f} /> : null;
                })}
              </div>
              {meal?.planned_food_ids &&
                meal.status === "remplace" &&
                (() => {
                  const initial = meal
                    .planned_food_ids!.map((id) => foodById.get(id)?.name)
                    .filter(Boolean);
                  return initial.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Au programme ce jour-là : {initial.join(", ")}.
                    </p>
                  ) : null;
                })()}
            </section>
          )}

          <section className="space-y-2">
            <p className="text-sm font-medium">Il a mangé plutôt…</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((f) => (
                <Pill key={f.id} f={f} muted />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Chercher un aliment"
                className="pl-9"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {searchResults.map((f) => (
                  <Pill key={f.id} f={f} muted />
                ))}
              </div>
            )}
          </section>

          {/* Avertissements : on informe, on ne bloque pas. */}
          {novelties.length > 0 && (
            <p className="flex items-start gap-2 rounded-md border border-novelty/30 bg-novelty-soft px-3.5 py-3 text-sm text-foreground/85">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-novelty" />
              <span>
                {novelties.length === 1
                  ? `${novelties[0]!.name}, il ne l'avait jamais goûté — on le reproposera demain.`
                  : `Deux nouveautés d'un coup : on les reproposera, et en cas de réaction il sera plus difficile de savoir laquelle est en cause.`}
              </span>
            </p>
          )}
          {tooYoung.map((f) => (
            <p
              key={f!.id}
              className="rounded-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground"
            >
              {f!.name} est habituellement proposé à partir de{" "}
              {f!.age_introduction_min} mois. C'est noté quand même.
            </p>
          ))}
          {restricted.map((f) => (
            <p
              key={f!.id}
              className="flex items-start gap-2 rounded-md bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="font-medium">{f!.name}</span> —{" "}
                {f!.restrictions}
              </span>
            </p>
          ))}
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selected.size} aliment{selected.size > 1 ? "s" : ""}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button onClick={save} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              C'est noté
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
