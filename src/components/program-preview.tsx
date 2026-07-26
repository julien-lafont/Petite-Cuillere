"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Lock, PencilLine } from "lucide-react";
import { MealCard } from "@/components/meal-card";
import { BrandMark } from "@/components/brand-mark";
import { ageBetween } from "@/lib/age";
import { momentLabel, momentRank, type Preview } from "@/lib/program/preview";
import type { BabySetup } from "@/lib/data/baby.actions";
import { subjectPronoun } from "@/lib/sexe";

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * Aperçu du programme sans compte (décision D3) : le premier jour est montré en
 * entier — c'est la récompense —, les jours suivants en résumé. Rien n'est
 * modifiable et rien n'est noté : la création du compte débloque tout cela.
 */
export function ProgramPreview({
  setup,
  preview,
  onEdit,
}: {
  setup: BabySetup;
  preview: Preview;
  onEdit: () => void;
}) {
  const ageMonths = ageBetween(new Date(setup.dateNaissance)).months;

  // Occurrences par aliment sur toute la période — alimente l'indice congélation.
  const upcomingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const day of preview.days) {
      for (const meal of day.meals) {
        for (const item of meal.meal_items) {
          if (item.food) counts[item.food.id] = (counts[item.food.id] ?? 0) + 1;
        }
      }
    }
    return counts;
  }, [preview]);

  const firstDay = preview.days.find((d) => d.meals.length > 0);
  const laterDays = preview.days
    .filter((d) => d.meals.length > 0 && d !== firstDay)
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/85 px-5 backdrop-blur-md md:px-8">
        <BrandMark />
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PencilLine className="size-4" />
          Modifier
        </button>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-10 md:px-8">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Le programme de {setup.prenom}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Voici par quoi commencer
          </h1>
          <p className="mt-3 text-muted-foreground">
            Adapté à ses {ageMonths} mois, et à ce qu'
            {subjectPronoun(setup.sexe)} a déjà goûté.
          </p>
        </div>

        {firstDay ? (
          <section className="mt-10 space-y-4">
            <h2 className="font-heading text-lg font-semibold capitalize">
              {dayFmt.format(new Date(`${firstDay.dateISO}T00:00:00`))}
            </h2>
            {[...firstDay.meals]
              .sort(
                (a, b) =>
                  momentRank(a.meal_moment_id) - momentRank(b.meal_moment_id),
              )
              .map((meal) => (
                <MealCard
                  key={meal.id}
                  momentLabel={momentLabel(meal.meal_moment_id)}
                  meal={meal}
                  ageMonths={ageMonths}
                  introducedIds={preview.introducedIds}
                  upcomingCounts={upcomingCounts}
                />
              ))}
          </section>
        ) : (
          <p className="mt-10 rounded-lg border border-dashed p-6 text-center text-muted-foreground">
            À cet âge, bébé n'a encore besoin que de lait. Créez votre compte :
            on vous préviendra dès que la diversification pourra commencer.
          </p>
        )}

        {laterDays.length > 0 && (
          <section className="mt-10 space-y-3">
            <h2 className="font-heading text-lg font-semibold">
              Les jours suivants
            </h2>
            <div className="space-y-2">
              {laterDays.map((day) => (
                <div
                  key={day.dateISO}
                  className="rounded-lg border bg-card px-4 py-3"
                >
                  <p className="font-heading font-semibold capitalize">
                    {dayFmt.format(new Date(`${day.dateISO}T00:00:00`))}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {[...day.meals]
                      .sort(
                        (a, b) =>
                          momentRank(a.meal_moment_id) -
                          momentRank(b.meal_moment_id),
                      )
                      .map(
                        (m) =>
                          `${momentLabel(m.meal_moment_id)} : ${m.meal_items
                            .map((i) => i.food?.name)
                            .filter(Boolean)
                            .join(", ")}`,
                      )
                      .join(" · ")}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Conversion — jamais un mur brutal, une invitation */}
        <section className="mt-10 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground">
          <span className="mx-auto grid size-12 place-items-center rounded-md bg-primary-foreground/15">
            <Lock className="size-6" />
          </span>
          <h2 className="mt-5 font-heading text-2xl font-semibold tracking-tight text-balance">
            Le programme de {setup.prenom} continue jusqu'à son 1ᵉʳ anniversaire
          </h2>
          <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left text-primary-foreground/90">
            {[
              "Les 8 mois de programme, jour par jour",
              "Noter les repas et suivre les allergènes",
              "La liste de courses avec les quantités",
              "Partager avec le co-parent et la nounou",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current" />
                {item}
              </li>
            ))}
          </ul>
          <Link
            href="/login"
            className="mt-7 inline-flex h-13 items-center gap-2 rounded-md bg-background px-7 text-base font-semibold text-foreground shadow-soft transition-transform hover:-translate-y-0.5"
          >
            Créer mon compte gratuit
            <ArrowRight className="size-5" />
          </Link>
          <p className="mt-3 text-sm text-primary-foreground/75">
            Vos réponses sont conservées — vous ne resaisirez rien.
          </p>
        </section>
      </main>
    </div>
  );
}
