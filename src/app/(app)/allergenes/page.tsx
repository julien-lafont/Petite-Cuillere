import {
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarClock,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getActiveBaby } from "@/lib/data/baby";
import { APP_ALLERGENES_URL } from "@/lib/routes";
import { getAllergens, getAllergenIntroductions } from "@/lib/data/allergens";
import { getMealsBetween } from "@/lib/data/meals";
import { isConfirmed } from "@/lib/data/meals.types";
import { getMealMoments } from "@/lib/data/meal-moments";
import { addDays, toISODate } from "@/lib/dates";
import {
  AllergenObservations,
  type ObservationItem,
} from "@/components/allergen-observations";
import { MethodEntryLink } from "@/components/method-page";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

type Exposure = { count: number; firstDate: string; hadReaction: boolean };

export default async function Page() {
  const baby = await getActiveBaby();
  if (!baby) return null;

  const todayISO = toISODate(new Date());
  const [allergens, introductions, meals, moments] = await Promise.all([
    getAllergens(),
    getAllergenIntroductions(baby.id),
    getMealsBetween(
      baby.id,
      toISODate(addDays(new Date(), -365)),
      toISODate(addDays(new Date(), 180)),
    ),
    getMealMoments(),
  ]);
  const momentLabel = new Map(moments.map((m) => [m.id, m.label]));

  // On ne compte que les repas passés ou du jour (un repas futur n'est pas « introduit »).
  const pastMeals = meals.filter((m) => m.date <= todayISO);

  const exposures = new Map<string, Exposure>();

  // 1. Expositions déclarées au rattrapage (onboarding), avec drapeau réaction.
  for (const intro of introductions) {
    exposures.set(intro.allergen_id, {
      count: 1,
      firstDate: intro.first_tried_on ?? todayISO,
      hadReaction: intro.had_reaction,
    });
  }

  // 2. Expositions déduites des repas passés (cumulées).
  //
  //    Seuls les repas confirmés comptent. Un repas passé que personne n'a
  //    renseigné n'a peut-être pas eu lieu : sur un allergène, le présumer
  //    ferait croire l'enfant protégé alors qu'il n'a jamais touché à
  //    l'arachide (asymétrie de confiance, docs/feats/suivi-reel §3). Ces
  //    expositions-là s'affichent « à confirmer », jamais « introduit ».
  const awaiting = new Map<string, { count: number; lastDate: string }>();
  const observationItems: ObservationItem[] = [];
  for (const meal of pastMeals) {
    const servedTypes = new Set(
      meal.meal_items
        .filter((it) => !it.skipped && it.food?.allergen_type)
        .map((it) => it.food!.allergen_type!.trim().toLowerCase()),
    );
    const carriesNothing = meal.meal_items.every(
      (it) => !it.food?.allergen_type,
    );

    for (const link of meal.meal_allergens) {
      const id = link.allergen?.id;
      if (!id) continue;
      // Le support de l'allergène a-t-il bien été servi ? Un lien orphelin
      // (aucun aliment porteur) est admis : il vient d'une saisie manuelle.
      const carrierServed =
        carriesNothing ||
        servedTypes.has((link.allergen?.name ?? "").trim().toLowerCase());
      if (!isConfirmed(meal) || !carrierServed) {
        const pending = awaiting.get(id);
        if (pending) {
          pending.count += 1;
          if (meal.date > pending.lastDate) pending.lastDate = meal.date;
        } else {
          awaiting.set(id, { count: 1, lastDate: meal.date });
        }
        continue;
      }
      const cur = exposures.get(id);
      if (cur) {
        cur.count += 1;
        if (meal.date < cur.firstDate) cur.firstDate = meal.date;
      } else {
        exposures.set(id, {
          count: 1,
          firstDate: meal.date,
          hadReaction: false,
        });
      }
    }
    if (meal.intake_observations.length > 0) {
      observationItems.push({
        meal,
        momentLabel: meal.meal_moment_id
          ? (momentLabel.get(meal.meal_moment_id) ?? "Repas")
          : "Repas",
        dateLabel: dateFmt.format(new Date(`${meal.date}T00:00:00`)),
      });
    }
  }
  // 3. Première exposition déjà planifiée, pour les allergènes pas encore
  //    introduits : on cherche le repas futur le plus proche qui les contient.
  //    Les repas ne sont pas triés côté requête, d'où la comparaison explicite.
  const plannedFirst = new Map<
    string,
    { date: string; momentId: string | null }
  >();
  for (const meal of meals) {
    if (meal.date <= todayISO) continue;
    for (const link of meal.meal_allergens) {
      const id = link.allergen?.id;
      if (!id || exposures.has(id)) continue;
      const cur = plannedFirst.get(id);
      if (!cur || meal.date < cur.date) {
        plannedFirst.set(id, {
          date: meal.date,
          momentId: meal.meal_moment_id,
        });
      }
    }
  }

  observationItems.sort((a, b) => b.meal.date.localeCompare(a.meal.date));
  const totalObservations = observationItems.reduce(
    (n, it) => n + it.meal.intake_observations.length,
    0,
  );

  const withReaction = allergens.filter(
    (a) => exposures.get(a.id)?.hadReaction,
  );
  const introduced = allergens.filter((a) => exposures.has(a.id));
  // Vus au programme, jamais confirmés : ni introduits, ni à introduire.
  const toConfirm = allergens.filter(
    (a) => !exposures.has(a.id) && awaiting.has(a.id),
  );
  const toIntroduce = allergens.filter(
    (a) => !exposures.has(a.id) && !awaiting.has(a.id),
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Les allergènes de {baby.prenom}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Ce qui a été introduit, quand, combien de fois, et les éventuels
          effets observés.
        </p>
        <MethodEntryLink
          className="mt-4"
          href={APP_ALLERGENES_URL}
          label="Comment les allergènes sont introduits"
          description="Pourquoi tôt, à quelle dose, jusqu'à quand — et les études derrière"
        />
      </header>

      {/* Réactions déclarées au rattrapage — priorité sécurité */}
      {withReaction.length > 0 && (
        <section className="rounded-lg border border-novelty/30 bg-novelty-soft p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-novelty" />
            <h2 className="font-heading text-base font-semibold text-foreground">
              À surveiller
            </h2>
          </div>
          <p className="mt-1 text-sm text-foreground/80">
            Une réaction a été signalée avec{" "}
            {withReaction.map((a) => a.name.toLowerCase()).join(", ")}. Ces
            aliments ne sont pas reproposés automatiquement — parlez-en à un
            professionnel de santé avant toute nouvelle tentative.
          </p>
        </section>
      )}

      {/* Effets indésirables observés dans les repas */}
      {totalObservations > 0 && (
        <section className="rounded-lg border border-destructive/30 bg-destructive/[0.04] p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" />
            <h2 className="font-heading text-base font-semibold text-destructive">
              Effets indésirables observés ({totalObservations})
            </h2>
          </div>
          <div className="mt-3 space-y-2">
            <AllergenObservations items={observationItems} />
            <p className="pt-1 text-xs text-muted-foreground">
              Touchez une ligne pour voir le repas. En cas de réaction, demandez
              conseil à un professionnel de santé.
            </p>
          </div>
        </section>
      )}

      {/* Introduits */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" />
          <h2 className="font-heading text-lg font-semibold">Introduits</h2>
          <Badge variant="secondary">{introduced.length}</Badge>
        </div>
        {introduced.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {introduced.map((a) => {
              const e = exposures.get(a.id)!;
              return (
                <div key={a.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-heading font-semibold">{a.name}</p>
                    <div className="flex items-center gap-1.5">
                      {e.hadReaction && (
                        <Badge className="bg-novelty text-novelty-foreground">
                          réaction
                        </Badge>
                      )}
                      <Badge variant="secondary">{e.count}×</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    1ʳᵉ introduction :{" "}
                    {dateFmt.format(new Date(`${e.firstDate}T00:00:00`))}
                  </p>
                  {a.intro_window && (
                    <p className="text-sm text-muted-foreground">
                      Fenêtre conseillée : {a.intro_window}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            Aucun allergène introduit pour l'instant. Le programme les proposera
            un par un, en sécurité.
          </p>
        )}
      </section>

      {/* À confirmer — le programme les a proposés, personne n'a dit si le
          repas avait eu lieu. On ne les compte pas comme introduits : mieux
          vaut une question ouverte qu'une fausse sécurité. */}
      {toConfirm.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="size-5 text-muted-foreground" />
            <h2 className="font-heading text-lg font-semibold">À confirmer</h2>
            <Badge variant="secondary">{toConfirm.length}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Le programme les a proposés, mais les repas concernés n'ont pas été
            renseignés. Dites-nous s'ils ont bien été donnés depuis l'écran du
            jour — c'est la seule chose que nous ne pouvons pas deviner.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {toConfirm.map((a) => {
              const pending = awaiting.get(a.id)!;
              return (
                <div
                  key={a.id}
                  className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/30 p-4"
                >
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-heading font-semibold">{a.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Proposé{" "}
                      {dateFmt.format(new Date(`${pending.lastDate}T00:00:00`))}
                      {pending.count > 1
                        ? ` et ${pending.count - 1} autre${pending.count > 2 ? "s" : ""} fois`
                        : ""}
                      .
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* À introduire */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">À introduire</h2>
          <Badge variant="secondary">{toIntroduce.length}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {toIntroduce.map((a) => {
            const planned = plannedFirst.get(a.id);
            const plannedMoment = planned?.momentId
              ? momentLabel.get(planned.momentId)
              : null;
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-dashed p-4"
              >
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-novelty" />
                <div>
                  <p className="font-heading font-semibold">{a.name}</p>
                  {a.intro_window && (
                    <p className="text-sm text-muted-foreground">
                      Fenêtre conseillée : {a.intro_window}
                    </p>
                  )}
                  {planned && (
                    <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-primary">
                      <CalendarClock
                        aria-hidden
                        className="mt-0.5 size-4 shrink-0"
                      />
                      <span>
                        1ʳᵉ exposition prévue :{" "}
                        {dateFmt.format(new Date(`${planned.date}T00:00:00`))}
                        {plannedMoment
                          ? ` (${plannedMoment.toLowerCase()})`
                          : null}
                      </span>
                    </p>
                  )}
                  {a.note && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {a.note}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
