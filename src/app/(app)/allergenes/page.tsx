import { ShieldAlert, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentBaby } from "@/lib/data/baby";
import { getAllergens } from "@/lib/data/allergens";
import { getMealsBetween } from "@/lib/data/meals";
import { getMealMoments } from "@/lib/data/meal-moments";
import { addDays, toISODate } from "@/lib/dates";
import {
  AllergenObservations,
  type ObservationItem,
} from "@/components/allergen-observations";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export default async function Page() {
  const baby = await getCurrentBaby();
  if (!baby) return null;

  const todayISO = toISODate(new Date());
  const [allergens, meals, moments] = await Promise.all([
    getAllergens(),
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

  const exposures = new Map<string, { count: number; firstDate: string }>();
  const observationItems: ObservationItem[] = [];

  for (const meal of pastMeals) {
    for (const link of meal.meal_allergens) {
      const id = link.allergen?.id;
      if (!id) continue;
      const cur = exposures.get(id);
      if (cur) {
        cur.count += 1;
        if (meal.date < cur.firstDate) cur.firstDate = meal.date;
      } else {
        exposures.set(id, { count: 1, firstDate: meal.date });
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
  observationItems.sort((a, b) => b.meal.date.localeCompare(a.meal.date));
  const totalObservations = observationItems.reduce(
    (n, it) => n + it.meal.intake_observations.length,
    0,
  );

  const introduced = allergens.filter((a) => exposures.has(a.id));
  const toIntroduce = allergens.filter((a) => !exposures.has(a.id));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight md:text-3xl">
          Suivi des allergènes
        </h1>
        <p className="mt-1 text-muted-foreground">
          Ce qui a été introduit à {baby.prenom}, quand, combien de fois, et les
          éventuels effets observés.
        </p>
      </div>

      {/* Effets indésirables — mis en avant (sécurité) */}
      {totalObservations > 0 && (
        <Card className="border-destructive/30 bg-destructive/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-destructive">
              <AlertTriangle className="size-4" />
              Effets indésirables observés ({totalObservations})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <AllergenObservations items={observationItems} />
            <p className="pt-1 text-xs text-muted-foreground">
              Touche une ligne pour voir le repas. En cas de réaction, demandez
              conseil à un professionnel de santé.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Introduits */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" />
          <h2 className="font-heading text-lg font-bold">Introduits</h2>
          <Badge variant="secondary">{introduced.length}</Badge>
        </div>
        {introduced.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {introduced.map((a) => {
              const e = exposures.get(a.id)!;
              return (
                <div key={a.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-heading font-bold">{a.name}</p>
                    <Badge variant="secondary">{e.count}×</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    1ʳᵉ introduction :{" "}
                    {dateFmt.format(new Date(`${e.firstDate}T00:00:00`))}
                  </p>
                  {a.intro_window && (
                    <p className="text-xs text-muted-foreground">
                      Fenêtre conseillée : {a.intro_window}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun allergène introduit pour l&apos;instant. Ajoute-les depuis un
            repas (onglet Aujourd&apos;hui ou Menu).
          </p>
        )}
      </section>

      {/* À introduire */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="size-5 text-muted-foreground" />
          <h2 className="font-heading text-lg font-bold">À introduire</h2>
          <Badge variant="secondary">{toIntroduce.length}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {toIntroduce.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 rounded-xl border border-dashed p-4"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-heading font-bold">{a.name}</p>
                {a.intro_window && (
                  <p className="text-xs text-muted-foreground">
                    Fenêtre conseillée : {a.intro_window}
                  </p>
                )}
                {a.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Repère d&apos;organisation, pas un avis médical.
      </p>
    </div>
  );
}
