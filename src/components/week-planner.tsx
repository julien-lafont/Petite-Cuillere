"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { addDays, toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MealEvaluateDialog } from "@/components/meal-evaluate-dialog";
import { MealPlanDialog } from "@/components/meal-plan-dialog";
import { MealLogDialog } from "@/components/meal-log-dialog";
import { AutoProgramDialog } from "@/components/auto-program-dialog";
import { indexMeals, mealKey, type MealWithDetails } from "@/lib/data/meals.types";
import { momentOpensAtMonths } from "@/lib/program/plan";
import { ageMonthsDecimalAtDate } from "@/lib/food-eligibility";
import type { MealMoment } from "@/lib/data/meal-moments";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";

const weekdayFmt = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
const dialogDateFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const rangeFmt = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

/** Parse une date ISO 'YYYY-MM-DD' en heure locale (évite les décalages de fuseau). */
const parseLocal = (iso: string) => new Date(`${iso}T00:00:00`);

const RESULT_DOT: Record<string, string> = {
  bien: "bg-primary",
  moyen: "bg-chart-3",
  refuse: "bg-destructive",
};

export function WeekPlanner({
  babyId,
  days,
  moments,
  meals,
  foods,
  allergens,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  babyId: string;
  days: string[]; // ISO 'YYYY-MM-DD', lundi → dimanche
  moments: MealMoment[];
  meals: MealWithDetails[];
  foods: FoodRow[];
  allergens: AllergenRow[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{
    date: string;
    momentId: string;
    mode: "evaluate" | "plan" | "log";
  } | null>(null);

  const index = indexMeals(meals);
  const todayISO = toISODate(new Date());

  // Âge projeté (décimal) du bébé pour chaque jour, et âge d'ouverture de chaque créneau.
  const dayAgeMonths = new Map(
    days.map((iso) => [
      iso,
      ageMonthsDecimalAtDate(iso, birthDate, dueDate, ageReferenceDate),
    ]),
  );
  const momentOpenAge = new Map(
    moments.map((m) => [m.id, momentOpensAtMonths(m.label)]),
  );

  const prevWeek = toISODate(addDays(parseLocal(days[0]), -7));
  const nextWeek = toISODate(addDays(parseLocal(days[0]), 7));
  const rangeLabel = `${rangeFmt.format(parseLocal(days[0]))} – ${rangeFmt.format(parseLocal(days[6]))}`;
  const goToWeek = (dateISO: string) => router.push(`/semaine?week=${dateISO}`);

  const selectedMeal = selected
    ? (index.get(mealKey(selected.date, selected.momentId)) ?? null)
    : null;
  const selectedMoment = selected
    ? moments.find((m) => m.id === selected.momentId)
    : null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
            Le planning
          </h1>
          <p className="mt-1 capitalize text-muted-foreground">{rangeLabel}</p>
        </div>
        <AutoProgramDialog babyId={babyId} weekStartISO={days[0]} />
      </div>

      {/* Navigation entre semaines */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => goToWeek(prevWeek)}
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <input
          type="date"
          value={days[0]}
          onChange={(e) => e.target.value && goToWeek(e.target.value)}
          aria-label="Aller à une date"
          className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => goToWeek(nextWeek)}
          aria-label="Semaine suivante"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => goToWeek(todayISO)}>
          Aujourd&apos;hui
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto pb-2">
        <div className="grid min-w-[880px] grid-cols-[110px_repeat(7,1fr)] gap-2">
          <div />
          {days.map((iso) => {
            const d = parseLocal(iso);
            const isToday = iso === todayISO;
            return (
              <div
                key={iso}
                className={cn(
                  "rounded-lg px-2 py-2 text-center",
                  isToday ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                <p className="text-xs font-medium capitalize">
                  {weekdayFmt.format(d).replace(".", "")}
                </p>
                <p className="font-heading text-lg font-bold">{d.getDate()}</p>
              </div>
            );
          })}

          {moments.map((moment) => (
            <div key={moment.id} className="contents">
              <div className="flex items-center pr-2 text-sm font-semibold">
                {moment.label}
              </div>
              {days.map((iso) => {
                const meal = index.get(mealKey(iso, moment.id));
                const items = meal?.meal_items ?? [];
                const isPast = iso <= todayISO;
                const isEmpty = items.length === 0;
                // Créneau pas encore « ouvert » d'après l'âge projeté et le stade de
                // diversification (cf. docs/auto-diversification-program.md §3).
                const isOpen =
                  (dayAgeMonths.get(iso) ?? Infinity) >=
                  (momentOpenAge.get(moment.id) ?? 0);
                return (
                  <button
                    key={iso + moment.id}
                    title={
                      !isOpen
                        ? "Créneau pas encore ouvert à cet âge"
                        : undefined
                    }
                    onClick={() =>
                      setSelected({
                        date: iso,
                        momentId: moment.id,
                        mode: !isPast ? "plan" : isEmpty ? "log" : "evaluate",
                      })
                    }
                    className={cn(
                      "flex min-h-[64px] flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                      !isOpen
                        ? "border-dashed border-muted bg-muted/30 text-muted-foreground/40 hover:border-muted-foreground/30"
                        : items.length
                          ? "bg-card hover:border-primary/40"
                          : "border-dashed text-muted-foreground/60 hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {items.length ? (
                      <>
                        {(meal?.result ||
                          (meal?.intake_observations?.length ?? 0) > 0) && (
                          <div className="flex items-center gap-1">
                            {meal?.result && (
                              <span
                                className={cn(
                                  "size-2 rounded-full",
                                  RESULT_DOT[meal.result],
                                )}
                              />
                            )}
                            {(meal?.intake_observations?.length ?? 0) > 0 && (
                              <AlertTriangle className="size-3 text-destructive" />
                            )}
                          </div>
                        )}
                        {items.map((it) => (
                          <Badge
                            key={it.id}
                            variant="secondary"
                            className="justify-start font-normal"
                          >
                            {it.food?.name ?? "?"}
                          </Badge>
                        ))}
                        {(meal?.meal_allergens?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {meal!.meal_allergens.map((a) => (
                              <span
                                key={a.id}
                                className="flex items-center gap-0.5 rounded bg-chart-3/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                              >
                                <ShieldAlert className="size-2.5" />
                                {a.allergen?.name ?? "?"}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <Plus className="m-auto size-4" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {selected && selectedMoment && selected.mode === "evaluate" && (
        <MealEvaluateDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          babyId={babyId}
          date={selected.date}
          momentId={selected.momentId}
          momentLabel={selectedMoment.label}
          dateLabel={dialogDateFmt.format(parseLocal(selected.date))}
          meal={selectedMeal}
          onEditFoods={() =>
            setSelected((s) => (s ? { ...s, mode: "plan" } : s))
          }
        />
      )}

      {selected && selectedMoment && selected.mode === "plan" && (
        <MealPlanDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          babyId={babyId}
          date={selected.date}
          momentId={selected.momentId}
          momentLabel={selectedMoment.label}
          dateLabel={dialogDateFmt.format(parseLocal(selected.date))}
          meal={selectedMeal}
          foods={foods}
          allergens={allergens}
          birthDate={birthDate}
          dueDate={dueDate}
          ageReferenceDate={ageReferenceDate}
        />
      )}

      {selected && selectedMoment && selected.mode === "log" && (
        <MealLogDialog
          open
          onOpenChange={(v) => !v && setSelected(null)}
          babyId={babyId}
          date={selected.date}
          momentId={selected.momentId}
          momentLabel={selectedMoment.label}
          dateLabel={dialogDateFmt.format(parseLocal(selected.date))}
          meal={selectedMeal}
          foods={foods}
          allergens={allergens}
          birthDate={birthDate}
          dueDate={dueDate}
          ageReferenceDate={ageReferenceDate}
        />
      )}
    </>
  );
}
