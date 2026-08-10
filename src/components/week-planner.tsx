"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  Ban,
} from "lucide-react";
import { setDayAbsent } from "@/lib/data/meal-reality.actions";
import { addDays, toISODate } from "@/lib/dates";
import { awaitsSignalAt } from "@/lib/moments";
import type { Now } from "@/lib/clock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/date-picker";
import { MealEvaluateDialog } from "@/components/meal-evaluate-dialog";
import { MealPlanDialog } from "@/components/meal-plan-dialog";
import { MealLogDialog } from "@/components/meal-log-dialog";
import { MealRealitySheet } from "@/components/meal-reality-sheet";
import { AutoProgramDialog } from "@/components/auto-program-dialog";
import {
  indexMeals,
  mealKey,
  type MealWithDetails,
} from "@/lib/data/meals.types";
import { momentOpensAtMonths } from "@/lib/program/schedule";
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

/**
 * Les signaux d'un repas — résultat, non-donné, non-renseigné, observation.
 * Partagés par la grille et la vue mobile, en `span` pour tenir dans un bouton.
 */
function StatusMarks({
  meal,
  skipped,
  unanswered,
}: {
  meal: MealWithDetails | undefined;
  skipped: boolean;
  unanswered: boolean;
}) {
  const observed = (meal?.intake_observations?.length ?? 0) > 0;
  if (!meal?.result && !skipped && !unanswered && !observed) return null;

  return (
    <span className="flex items-center gap-1">
      {meal?.result && (
        <span className={cn("size-2 rounded-full", RESULT_DOT[meal.result])} />
      )}
      {skipped && (
        <span className="text-[10px] font-medium uppercase tracking-wide">
          pas donné
        </span>
      )}
      {unanswered && (
        <span
          title="Ce repas n'a pas été renseigné"
          className="text-[11px] font-semibold text-muted-foreground/70"
        >
          ?
        </span>
      )}
      {observed && <AlertTriangle className="size-3 text-destructive" />}
    </span>
  );
}

/** Les allergènes portés par le repas. */
function AllergenChips({ meal }: { meal: MealWithDetails | undefined }) {
  if (!meal?.meal_allergens?.length) return null;

  return (
    <span className="flex flex-wrap gap-1">
      {meal.meal_allergens.map((a) => (
        <span
          key={a.id}
          className="flex items-center gap-0.5 rounded bg-chart-3/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
        >
          <ShieldAlert className="size-2.5" />
          {a.allergen?.name ?? "?"}
        </span>
      ))}
    </span>
  );
}

export function WeekPlanner({
  babyId,
  programComplete,
  now,
  days,
  moments,
  meals,
  foods,
  allergens,
  introducedIds,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  babyId: string;
  /** Programme déjà généré jusqu'au premier anniversaire → rien à générer de plus. */
  programComplete: boolean;
  /**
   * L'instant, vu du foyer. Vient du serveur et non de `new Date()` : le
   * navigateur d'un aidant en déplacement n'a pas à décider quel jour on est
   * chez l'enfant (docs/feats/creneaux-horaires.md §3.2).
   */
  now: Now;
  days: string[]; // ISO 'YYYY-MM-DD', lundi → dimanche
  moments: MealMoment[];
  meals: MealWithDetails[];
  foods: FoodRow[];
  allergens: AllergenRow[];
  /** Aliments déjà connus de l'enfant — proposés d'abord dans la correction. */
  introducedIds: string[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<{
    date: string;
    momentId: string;
    mode: "evaluate" | "plan" | "log" | "reality";
  } | null>(null);
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  const [weekPending, startWeek] = useTransition();
  const [absencePending, startAbsence] = useTransition();
  const [absenceMessage, setAbsenceMessage] = useState<string | null>(null);

  const index = indexMeals(meals);
  const momentById = new Map(moments.map((m) => [m.id, m]));
  const todayISO = now.todayISO;

  function declareAbsence(dateISO: string) {
    startAbsence(async () => {
      const res = await setDayAbsent(babyId, dateISO);
      router.refresh();
      setAbsenceMessage(res.sentence);
    });
  }

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

  /**
   * Ce qu'il y a à montrer pour une case (jour × créneau). La grille de bureau
   * et la vue « un jour à la fois » du mobile lisent la même fonction : deux
   * présentations, une seule règle.
   */
  function cellState(iso: string, momentId: string) {
    const meal = index.get(mealKey(iso, momentId));
    const items = meal?.meal_items ?? [];
    const isPast = iso <= todayISO;
    const isEmpty = items.length === 0;
    // Ce qui s'est réellement passé. Un repas non donné se montre barré et
    // grisé — jamais en rouge, jamais avec un signe négatif : c'est une
    // information, pas un reproche (D8).
    const skipped = meal?.status === "saute";
    // Passé sans signal : le seul indice réel dont on dispose. Le « ? » invite
    // à corriger, sans rien affirmer. « Passé » se lit désormais à l'heure et
    // non à la date, pour que la grille dise la même chose que l'écran du jour
    // (docs/feats/creneaux-horaires.md §6.2).
    const unanswered =
      !isEmpty &&
      meal !== undefined &&
      awaitsSignalAt(meal, momentById.get(momentId), now);
    // Créneau pas encore « ouvert » d'après l'âge projeté et le stade de
    // diversification (cf. docs/auto-diversification-program.md §3).
    const isOpen =
      (dayAgeMonths.get(iso) ?? Infinity) >= (momentOpenAge.get(momentId) ?? 0);
    // Un jour passé ou aujourd'hui, avec quelque chose de prévu : c'est le réel
    // qu'on vient corriger, pas le plan qu'on vient composer.
    const mode: "plan" | "log" | "reality" = !isPast
      ? "plan"
      : isEmpty
        ? "log"
        : "reality";
    return { meal, items, isEmpty, skipped, unanswered, isOpen, mode };
  }

  /** Journée entièrement déclarée « pas là ». */
  const dayIsAbsent = (iso: string) =>
    moments.length > 0 &&
    moments.every((m) => index.get(mealKey(iso, m.id))?.status === "saute");

  /** Au moins un repas composé ce jour-là — le point sous la pastille du ruban. */
  const dayHasPlan = (iso: string) =>
    moments.some(
      (m) => (index.get(mealKey(iso, m.id))?.meal_items.length ?? 0) > 0,
    );

  /**
   * Le jour montré par la vue mobile : celui qu'on a choisi tant qu'il
   * appartient à la semaine affichée, sinon aujourd'hui, sinon le lundi.
   * Changer de semaine recale donc le curseur de lui-même, sans effet.
   */
  const activeDay =
    pickedDay && days.includes(pickedDay)
      ? pickedDay
      : days.includes(todayISO)
        ? todayISO
        : days[0];

  const prevWeek = toISODate(addDays(parseLocal(days[0]), -7));
  const nextWeek = toISODate(addDays(parseLocal(days[0]), 7));
  const rangeLabel = `${rangeFmt.format(parseLocal(days[0]))} – ${rangeFmt.format(parseLocal(days[6]))}`;
  /**
   * Changer de semaine est une navigation serveur comme une autre : sans
   * transition explicite, rien ne bouge tant que la réponse n'est pas là.
   * `weekPending` acquitte le clic sur-le-champ.
   */
  const goToWeek = (dateISO: string) => {
    // La vue mobile suit la date demandée : « Aujourd'hui », ou une date prise
    // au calendrier, ouvre ce jour-là — pas le lundi de sa semaine.
    setPickedDay(dateISO);
    startWeek(() => router.push(`/semaine?week=${dateISO}`));
  };

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
        {!programComplete && (
          <AutoProgramDialog babyId={babyId} weekStartISO={days[0]} />
        )}
      </div>

      {/* Navigation entre semaines */}
      <div
        aria-busy={weekPending}
        className={cn(
          "mt-4 flex flex-wrap items-center gap-2 transition-opacity",
          weekPending && "opacity-60",
        )}
      >
        <Button
          variant="outline"
          size="icon"
          disabled={weekPending}
          onClick={() => goToWeek(prevWeek)}
          aria-label="Semaine précédente"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <DatePicker
          value={days[0]}
          onChange={goToWeek}
          placeholder="Aller à une date"
          className="h-9 w-auto min-w-44 text-sm"
        />
        <Button
          variant="outline"
          size="icon"
          disabled={weekPending}
          onClick={() => goToWeek(nextWeek)}
          aria-label="Semaine suivante"
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={weekPending}
          onClick={() => goToWeek(todayISO)}
        >
          Aujourd'hui
        </Button>
      </div>

      {absenceMessage && (
        <p className="mt-3 rounded-md bg-accent px-3.5 py-2.5 text-sm text-accent-foreground">
          {absenceMessage}
        </p>
      )}

      {/*
        Un jour à la fois, sous xl. La grille tient huit colonnes dans 880 px :
        avec la barre latérale de 256 px et la gouttière, il faut 1280 px de
        fenêtre pour l'afficher sans défilement latéral — en deçà (mobile,
        tablette, petit portable), c'est cette vue-ci qui sert.
      */}
      <div className="mt-4 xl:hidden">
        {/* Le ruban des sept jours : le seul endroit où la semaine se lit d'un coup. */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((iso) => {
            const d = parseLocal(iso);
            const isActive = iso === activeDay;
            const absent = dayIsAbsent(iso);
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={isActive}
                aria-label={dialogDateFmt.format(d)}
                onClick={() => setPickedDay(iso)}
                className={cn(
                  "flex min-h-15 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : iso === todayISO
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted",
                )}
              >
                <span className="text-[11px] font-medium capitalize">
                  {weekdayFmt.format(d).replace(".", "")}
                </span>
                <span className="font-heading text-base font-bold">
                  {d.getDate()}
                </span>
                {/* Absence : un trait. Repas prévus : un point. Rien : rien. */}
                <span
                  aria-hidden
                  className={cn(
                    "h-1 rounded-full bg-current",
                    absent
                      ? "w-3 opacity-40"
                      : dayHasPlan(iso)
                        ? "w-1 opacity-70"
                        : "w-1 opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="font-heading text-lg font-semibold capitalize">
            {dialogDateFmt.format(parseLocal(activeDay))}
          </p>
          {/* Le meilleur signal est celui donné en avance : annoncer une absence
              décale le plan avant que le problème existe, et la liste de courses
              avec lui (R12). */}
          {activeDay > todayISO && !dayIsAbsent(activeDay) && (
            <button
              type="button"
              onClick={() => declareAbsence(activeDay)}
              disabled={absencePending}
              className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Ban className="size-4" />
              On ne sera pas là
            </button>
          )}
          {dayIsAbsent(activeDay) && (
            <span className="shrink-0 text-sm font-medium text-muted-foreground">
              On n'est pas là
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {moments.map((moment) => {
            const { meal, items, isEmpty, skipped, unanswered, isOpen, mode } =
              cellState(activeDay, moment.id);
            return (
              <button
                key={moment.id}
                type="button"
                onClick={() =>
                  setSelected({ date: activeDay, momentId: moment.id, mode })
                }
                className={cn(
                  "flex min-h-16 w-full items-start gap-3 rounded-lg border p-3.5 text-left transition-colors",
                  !isOpen
                    ? "border-dashed border-muted bg-muted/30 text-muted-foreground/50"
                    : skipped
                      ? "border-dashed bg-muted/40 text-muted-foreground/70"
                      : unanswered
                        ? "border-dashed bg-card hover:border-primary/40"
                        : items.length
                          ? "bg-card hover:border-primary/40"
                          : "border-dashed text-muted-foreground hover:border-primary/40 hover:text-primary",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-center gap-2">
                    <span className="font-heading text-sm font-semibold">
                      {moment.label}
                    </span>
                    <StatusMarks
                      meal={meal}
                      skipped={skipped}
                      unanswered={unanswered}
                    />
                  </span>
                  {items.length ? (
                    <>
                      <span className="flex flex-wrap gap-1">
                        {items.map((it) => (
                          <Badge
                            key={it.id}
                            variant="secondary"
                            className={cn(
                              "font-normal",
                              (skipped || it.skipped) &&
                                "line-through opacity-60",
                            )}
                          >
                            {it.food?.name ?? "?"}
                          </Badge>
                        ))}
                      </span>
                      <AllergenChips meal={meal} />
                    </>
                  ) : (
                    <span className="text-sm">
                      {isOpen
                        ? "Composer ce repas"
                        : "Pas encore de ce repas à cet âge"}
                    </span>
                  )}
                </span>
                {isEmpty && isOpen && (
                  <Plus className="mt-0.5 size-5 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 hidden overflow-x-auto pb-2 xl:block">
        <div className="grid min-w-[880px] grid-cols-[110px_repeat(7,1fr)] gap-2">
          <div />
          {days.map((iso) => {
            const d = parseLocal(iso);
            const isToday = iso === todayISO;
            // Le meilleur signal est celui donné en avance : annoncer une
            // absence décale le plan avant que le problème existe, et la liste
            // de courses avec lui (R12).
            const canDeclareAbsence = iso > todayISO;
            const absent = dayIsAbsent(iso);
            return (
              <div
                key={iso}
                className={cn(
                  "rounded-lg px-2 py-2 text-center",
                  isToday
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground",
                )}
              >
                <p className="text-xs font-medium capitalize">
                  {weekdayFmt.format(d).replace(".", "")}
                </p>
                <p className="font-heading text-lg font-bold">{d.getDate()}</p>
                {canDeclareAbsence && !absent && (
                  <button
                    type="button"
                    title="On ne sera pas là ce jour-là"
                    onClick={() => declareAbsence(iso)}
                    disabled={absencePending}
                    className="mx-auto mt-0.5 flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Ban className="size-3" />
                    pas là
                  </button>
                )}
                {absent && (
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide">
                    pas là
                  </p>
                )}
              </div>
            );
          })}

          {moments.map((moment) => (
            <div key={moment.id} className="contents">
              <div className="flex items-center pr-2 text-sm font-semibold">
                {moment.label}
              </div>
              {days.map((iso) => {
                const { meal, items, skipped, unanswered, isOpen, mode } =
                  cellState(iso, moment.id);
                return (
                  <button
                    key={iso + moment.id}
                    title={
                      !isOpen
                        ? "Créneau pas encore ouvert à cet âge"
                        : undefined
                    }
                    onClick={() =>
                      setSelected({ date: iso, momentId: moment.id, mode })
                    }
                    className={cn(
                      "flex min-h-[64px] flex-col gap-1 rounded-lg border p-2 text-left transition-colors",
                      !isOpen
                        ? "border-dashed border-muted bg-muted/30 text-muted-foreground/40 hover:border-muted-foreground/30"
                        : skipped
                          ? "border-dashed bg-muted/40 text-muted-foreground/70"
                          : unanswered
                            ? "border-dashed bg-card hover:border-primary/40"
                            : items.length
                              ? "bg-card hover:border-primary/40"
                              : "border-dashed text-muted-foreground/60 hover:border-primary/40 hover:text-primary",
                    )}
                  >
                    {items.length ? (
                      <>
                        <StatusMarks
                          meal={meal}
                          skipped={skipped}
                          unanswered={unanswered}
                        />
                        {items.map((it) => (
                          <Badge
                            key={it.id}
                            variant="secondary"
                            className={cn(
                              "justify-start font-normal",
                              (skipped || it.skipped) &&
                                "line-through opacity-60",
                            )}
                          >
                            {it.food?.name ?? "?"}
                          </Badge>
                        ))}
                        <AllergenChips meal={meal} />
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

      {selected && selectedMoment && selected.mode === "reality" && (
        <MealRealitySheet
          key={`${selected.date}|${selected.momentId}`}
          open
          onOpenChange={(v) => !v && setSelected(null)}
          babyId={babyId}
          date={selected.date}
          momentId={selected.momentId}
          momentLabel={selectedMoment.label}
          dateLabel={dialogDateFmt.format(parseLocal(selected.date))}
          meal={selectedMeal}
          foods={foods}
          introducedIds={introducedIds}
          birthDate={birthDate}
          dueDate={dueDate}
          ageReferenceDate={ageReferenceDate}
        />
      )}
    </>
  );
}
