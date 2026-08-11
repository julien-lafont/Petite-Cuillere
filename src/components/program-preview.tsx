"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Gift,
  Lock,
  Mic,
  PencilLine,
  Replace,
  ShieldCheck,
  ShoppingBasket,
  Users,
} from "lucide-react";
import { MealCard } from "@/components/meal-card";
import { BrandMark } from "@/components/brand-mark";
import { ageBetween, daysUntilFirstBirthday } from "@/lib/age";
import { momentLabel, momentRank, type Preview } from "@/lib/program/preview";
import type { BabySetup } from "@/lib/data/baby.actions";
import { subjectPronoun } from "@/lib/sexe";
import { cn } from "@/lib/utils";

const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const monthFmt = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

/**
 * Jours suivants montrés en résumé. Une semaine entière : c'est l'unité dans
 * laquelle un parent pense ses courses et ses menus, et six lignes de deux
 * lignes chacune tiennent dans un écran — ce n'est pas ce résumé qui repoussait
 * l'invitation hors de vue, mais les fiches détaillées qui l'occupaient avant.
 */
const SUMMARY_DAYS = 6;

/**
 * Le geste de conversion, écrit une seule fois : partout le même mot et la même
 * destination. Deux tons, selon le fond sur lequel il est posé.
 */
function SignUpLink({
  children,
  tone = "solid",
  className,
}: {
  children: React.ReactNode;
  /** `solid` = vert sur fond clair ; `inverse` = clair sur fond vert. */
  tone?: "solid" | "inverse";
  className?: string;
}) {
  return (
    <Link
      href="/login"
      className={cn(
        "inline-flex min-h-13 items-center justify-center gap-2.5 rounded-full px-7 text-base font-bold transition-transform hover:-translate-y-0.5",
        tone === "solid"
          ? "bg-primary text-primary-foreground shadow-[0_8px_22px_-8px_var(--primary)]"
          : "bg-background text-foreground shadow-soft",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-5 shrink-0" />
    </Link>
  );
}

/** Pastille de nouveautés d'une journée résumée — même habillage que `NoveltyPill`. */
function NoveltyCount({ count }: { count: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-novelty-soft px-2.5 py-1 text-xs font-bold text-novelty">
      <span className="size-1.5 rounded-full bg-current" />
      {count === 1 ? "1 nouveauté" : `${count} nouveautés`}
    </span>
  );
}

/**
 * Aperçu du programme sans compte (décision D3) : le premier jour est montré en
 * entier — c'est la récompense —, les jours suivants en résumé. Rien n'est
 * modifiable et rien n'est noté : la création du compte débloque tout cela.
 *
 * ── Où sont les invitations à créer le compte ──────────────────────────────
 * Il y en avait une seule, tout en bas, après une semaine de repas détaillés :
 * sur mobile, deux ou trois écrans de défilement séparaient la récompense du
 * geste qu'on attend du parent. Elle est maintenant posée à quatre endroits,
 * chacun à un moment différent de la lecture :
 *
 *   l'en-tête           collant, visible dès la première seconde (grand écran) ;
 *   la barre basse      son équivalent tactile, sous le pouce, tout le long du
 *                       défilement — elle s'efface quand le bloc final arrive,
 *                       pour ne pas doubler le même bouton ;
 *   juste après le      le parent vient de voir ce qu'il aura : c'est là que
 *   premier jour        l'envie est la plus forte, et que la perte se dit ;
 *   le bloc final       l'argumentaire complet, pour qui a tout lu.
 *
 * Les jours suivants restent une semaine complète, mais résumés à une ligne
 * d'aliments chacun : le détail des recettes est ce que le compte débloque, et
 * l'étaler ici repoussait l'invitation hors de l'écran sans rien apprendre de
 * plus.
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
  const birth = new Date(setup.dateNaissance);
  const ageMonths = ageBetween(birth).months;

  // Durée qu'il reste à accompagner : c'est l'argument central de la page, il
  // vaut mieux qu'il soit vrai pour cet enfant-là qu'arrondi à « 8 mois ».
  const remainingDays = daysUntilFirstBirthday(birth);
  const remainingMonths = Math.max(1, Math.round(remainingDays / 30.44));
  const firstBirthday = new Date(birth);
  firstBirthday.setFullYear(firstBirthday.getFullYear() + 1);

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

  const firstDay = useMemo(
    () => preview.days.find((d) => d.meals.length > 0),
    [preview],
  );

  /**
   * Les journées résumées : les aliments du jour, dédupliqués et dans l'ordre
   * des repas, plus le nombre de découvertes. Les nouveautés se comptent en
   * avançant — un aliment vu au jour 2 n'en est plus une au jour 3.
   */
  const summaries = useMemo(() => {
    const seen = new Set(preview.introducedIds);
    for (const meal of firstDay?.meals ?? []) {
      for (const item of meal.meal_items) if (item.food) seen.add(item.food.id);
    }

    return preview.days
      .filter((d) => d.meals.length > 0 && d !== firstDay)
      .slice(0, SUMMARY_DAYS)
      .map((day) => {
        const names: string[] = [];
        let novelties = 0;
        const meals = [...day.meals].sort(
          (a, b) => momentRank(a.meal_moment_id) - momentRank(b.meal_moment_id),
        );
        for (const meal of meals) {
          for (const item of meal.meal_items) {
            const food = item.food;
            if (!food) continue;
            if (!seen.has(food.id)) {
              seen.add(food.id);
              novelties++;
            }
            if (!names.includes(food.name)) names.push(food.name);
          }
        }
        return { dateISO: day.dateISO, names, novelties };
      });
  }, [preview, firstDay]);

  /*
   * La barre basse s'efface dès que le bloc final entre dans l'écran : deux
   * fois le même bouton à dix pixels l'un de l'autre, c'est du bruit. `inert`
   * plutôt qu'`aria-hidden` seul — un lien caché mais focusable au clavier est
   * un piège pour qui navigue à la tabulation.
   */
  const finalCtaRef = useRef<HTMLElement>(null);
  const [finalCtaVisible, setFinalCtaVisible] = useState(false);

  useEffect(() => {
    const node = finalCtaRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFinalCtaVisible(entry.isIntersecting),
      { rootMargin: "0px 0px -120px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /*
   * Ce qui reste à découvrir une fois l'aperçu fini — compté depuis le dernier
   * jour montré et non depuis aujourd'hui : le programme peut démarrer plus
   * tard, et annoncer un chiffre faux au moment où l'on demande la confiance du
   * parent serait le pire endroit pour se tromper.
   */
  const lastShownISO = summaries.at(-1)?.dateISO ?? firstDay?.dateISO ?? null;
  const daysBeyondPreview = lastShownISO
    ? Math.max(
        0,
        Math.round(
          (firstBirthday.getTime() -
            new Date(`${lastShownISO}T00:00:00`).getTime()) /
            86_400_000,
        ),
      )
    : 0;

  /*
   * Chaque ligne commence par ce qu'elle apporte — un verbe à l'impératif ou la
   * chose elle-même. Enfilées, les tournures en « le… » se lisaient comme un
   * inventaire de rayonnage, où la première moitié de chaque phrase ne
   * transporte plus rien.
   */
  const perks = [
    {
      icon: CalendarDays,
      text: `Un repas prévu chaque jour jusqu'à son premier anniversaire, soit ${remainingMonths} mois de menus`,
    },
    {
      icon: Replace,
      text: "Remplacez un aliment qui vous manque, sautez un repas — le programme se réajuste tout seul",
    },
    {
      icon: ShieldCheck,
      text: "Chaque allergène sera introduit au moment idéal",
    },
    {
      icon: ShoppingBasket,
      text: "Liste de courses créée automatiquement à partir de tous les plats prévus de la semaine",
    },
    {
      icon: Mic,
      text: "Enregistrez et notez les repas en parlant à l'app, même les mains prises",
    },
    {
      icon: Users,
      text: "Partagez tout avec le co-parent et la nounou, chacun son accès",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-5 backdrop-blur-md md:px-8">
        <BrandMark />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PencilLine className="size-4" />
            Modifier
          </button>
          {/* Sur mobile, ce bouton est en bas de l'écran, sous le pouce. */}
          <Link
            href="/login"
            className="hidden h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-[0_6px_18px_-8px_var(--primary)] transition-transform hover:-translate-y-0.5 md:inline-flex"
          >
            Créer mon compte
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-10 pb-32 md:px-8 md:pb-16">
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

          {/* Ce que la page ne montre pas encore : la profondeur du programme.
              Trois preuves, dès le premier écran, pour que le parent sache que
              l'aperçu n'est pas tout ce qui existe. */}
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              { icon: CalendarDays, label: `${remainingMonths} mois de menus` },
              { icon: ShieldCheck, label: "Allergènes au bon moment" },
              { icon: Gift, label: "Gratuit" },
            ].map((proof) => (
              <li
                key={proof.label}
                className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground"
              >
                <proof.icon className="size-4 shrink-0 text-primary" />
                {proof.label}
              </li>
            ))}
          </ul>
        </div>

        {firstDay ? (
          <section className="mt-10 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-heading text-lg font-semibold capitalize">
                {dayFmt.format(new Date(`${firstDay.dateISO}T00:00:00`))}
              </h2>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Le premier jour, en entier
              </p>
            </div>
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

        {/* Première invitation : juste après la récompense, quand le parent
            vient de voir ce que le programme sait faire — et avant qu'il ait à
            défiler encore. Elle décrit ce que devient son quotidien plutôt que
            ce qu'il perdrait à partir : la menace, le parent l'a comprise seul,
            et le prix n'a rien à faire ici.

            L'abricot pâle est un fond, pas une couleur de texte : le corps
            reprend donc l'encre de la page (lisible dans les deux thèmes) et
            seul le titre, assez gros pour s'en contenter, porte la teinte. */}
        <section className="mt-8 rounded-2xl bg-accent px-6 py-8 text-center text-foreground">
          <h2 className="font-heading text-xl font-semibold text-balance text-accent-foreground md:text-2xl">
            Demain, et{" "}
            {remainingMonths > 1
              ? `les ${remainingMonths} mois qui suivent`
              : "le mois qui suit"}
          </h2>
          <p className="mx-auto mt-3 max-w-md leading-relaxed">
            Chaque matin, le repas de {setup.prenom} vous attend, prêt à
            cuisiner{" : "}
            la recette pas à pas, la quantité et la texture calées sur son âge.
            Les découvertes s'enchaînent au bon rythme, les allergènes arrivent
            quand il faut, et les courses de la semaine se préparent toutes
            seules.
          </p>
          <SignUpLink className="mt-6">
            Continuer le programme de {setup.prenom}
          </SignUpLink>
        </section>

        {summaries.length > 0 && (
          <section className="mt-10 space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="font-heading text-lg font-semibold">
                Les jours suivants
              </h2>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                En résumé
              </p>
            </div>
            <div className="space-y-2">
              {summaries.map((day) => (
                <div
                  key={day.dateISO}
                  className="rounded-lg border bg-card px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <p className="font-heading font-semibold capitalize">
                      {dayFmt.format(new Date(`${day.dateISO}T00:00:00`))}
                    </p>
                    {day.novelties > 0 && (
                      <NoveltyCount count={day.novelties} />
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {day.names.join(" · ")}
                  </p>
                </div>
              ))}
            </div>

            {/* Le reste du programme, montré comme ce qu'il est : présent, prêt,
                et derrière le compte. Cliquable — c'est la première chose qu'on
                essaie de toucher quand on voit un cadenas. */}
            {daysBeyondPreview > 1 && (
              <Link
                href="/login"
                className="flex items-center gap-3.5 rounded-lg border border-dashed border-primary/40 bg-secondary/60 px-4 py-4 text-left"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Lock className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-heading font-semibold">
                    Et {daysBeyondPreview} jours de plus, jusqu'en{" "}
                    {monthFmt.format(firstBirthday)}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Recettes, quantités et courses comprises. Tout est déjà
                    calculé pour {setup.prenom}.
                  </span>
                </span>
                <ArrowRight className="ml-auto size-5 shrink-0 text-primary" />
              </Link>
            )}
          </section>
        )}

        {/* Invitation finale — jamais un mur brutal, l'argumentaire complet */}
        <section
          ref={finalCtaRef}
          className="mt-10 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground"
        >
          <span className="mx-auto grid size-12 place-items-center rounded-md bg-primary-foreground/15">
            <Lock className="size-6" />
          </span>
          <h2 className="mt-5 font-heading text-2xl font-semibold tracking-tight text-balance">
            Le programme de {setup.prenom} continue jusqu'à son 1ᵉʳ anniversaire
          </h2>
          <ul className="mx-auto mt-6 max-w-sm space-y-3 text-left text-primary-foreground/90">
            {perks.map((perk) => (
              <li key={perk.text} className="flex items-start gap-3">
                <perk.icon className="mt-0.5 size-5 shrink-0" />
                <span className="leading-snug">{perk.text}</span>
              </li>
            ))}
          </ul>
          <SignUpLink tone="inverse" className="mt-7">
            Créer mon compte gratuit
          </SignUpLink>
          <p className="mt-3 text-sm text-primary-foreground/75">
            Vos réponses sont conservées — vous ne resaisirez rien. Sans
            publicité, sans carte bancaire.
          </p>
        </section>

        {/* Le parent qui a déjà un compte n'a rien à « créer » : sans cette
            ligne, il n'a d'autre chemin que de cliquer un bouton qui ne lui
            parle pas. */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {"Déjà un compte ? "}
          <Link href="/login" className="font-semibold underline">
            Se connecter
          </Link>
        </p>
      </main>

      {/* L'équivalent tactile de l'en-tête : le seul endroit qu'un pouce atteint
          sans changer de prise. Elle glisse hors de l'écran quand le bloc final
          apparaît. */}
      <div
        inert={finalCtaVisible}
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md transition-transform duration-200 md:hidden",
          finalCtaVisible && "translate-y-full",
        )}
      >
        <div className="pb-safe">
          <div className="px-4 pt-3 pb-3">
            <SignUpLink className="w-full">Créer mon compte gratuit</SignUpLink>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Gratuit · sans carte bancaire · le programme de {setup.prenom} est
              conservé
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
