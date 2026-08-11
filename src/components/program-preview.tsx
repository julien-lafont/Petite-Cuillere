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
  ShieldCheck,
  ShoppingBasket,
  Users,
} from "lucide-react";
import { MealCard } from "@/components/meal-card";
import { BrandMark } from "@/components/brand-mark";
import { ageBetween, daysUntilFirstBirthday } from "@/lib/age";
import { momentLabel, momentRank, type Preview } from "@/lib/program/preview";
import type { BabySetup } from "@/lib/data/baby.actions";
import { subjectPronoun, subjectPronounCap } from "@/lib/sexe";
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
 *
 * Ce mot est « garder le programme », jamais « créer mon compte ». À ce
 * moment-là de la lecture le parent vient de voir quelque chose qui lui
 * appartient déjà ; le compte n'est pas ce qu'il vient chercher, c'est
 * seulement le moyen de ne pas le perdre. La mention du compte gratuit
 * descend d'un cran, en légende sous le bouton.
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
 *   le bloc final       la conclusion, après le fil conducteur et les quatre
 *                       charges en moins, pour qui a tout lu.
 *
 * Partout le même mot — « garder le programme » et non « créer mon compte ».
 * Le compte n'est pas ce que le parent est venu chercher : il n'est que le
 * moyen de ne pas perdre ce que la page vient de lui montrer.
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
   * Les journées avec un bébé ne se passent jamais comme prévu, et c'est là
   * qu'un programme se perd. Trois situations que le parent reconnaît avant
   * d'avoir fini de les lire — plutôt qu'un mot de fonctionnalité comme
   * « réajustement », qui ne lui rappelle rien de vécu.
   */
  const mishaps = [
    { title: "Vous n'avez pas un ingrédient ?", body: "Remplacez-le." },
    { title: "Le repas a été sauté ?", body: "Continuez au suivant." },
    {
      title: `${subjectPronounCap(setup.sexe)} a mangé autre chose ?`,
      body: "Notez-le simplement.",
    },
  ];

  /*
   * Ce que le parent n'a plus à porter, une charge par ligne. Le titre porte le
   * bénéfice, la ligne en dessous dit seulement comment on le lui enlève : mis
   * bout à bout dans une seule phrase, comme avant, c'est le bénéfice qui se
   * diluait.
   */
  const perks = [
    {
      icon: ShieldCheck,
      title: "Les allergènes restent faciles à suivre",
      body: `Voyez ce qui a déjà été proposé à ${setup.prenom} et ce qui arrive ensuite.`,
    },
    {
      icon: ShoppingBasket,
      title: "Les courses se préparent avec le programme",
      body: "Les repas prévus servent automatiquement à préparer votre liste de la semaine.",
    },
    {
      icon: Mic,
      title: "Un repas se note en quelques mots",
      body: `Dites simplement ce que ${setup.prenom} a mangé, même quand vous avez les mains prises.`,
    },
    {
      icon: Users,
      title: "Tout le monde sait où il en est",
      body: "Co-parent ou nounou : chacun peut suivre le même programme avec son propre accès.",
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
            Garder son programme
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-10 pb-32 md:px-8 md:pb-16">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Le programme de {setup.prenom}
          </p>
          {/* Le parent vient de répondre à un questionnaire : il n'attend pas
              qu'on lui présente le produit, il attend de voir ce qu'il a
              obtenu. Le titre nomme donc la chose produite, pas l'étape
              suivante — « voici par quoi commencer » aurait pu être écrit
              avant même de connaître l'enfant. */}
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {firstDay
              ? "Le premier repas est prêt."
              : "Son programme est prêt à démarrer."}
          </h1>
          <p className="mt-3 text-muted-foreground">
            Construit pour ses {ageMonths} mois, et pour ce qu'
            {subjectPronoun(setup.sexe)} a déjà goûté.
          </p>

          {/* Ce que la page ne montre pas encore : la profondeur du programme.
              Trois preuves, dès le premier écran, pour que le parent sache que
              l'aperçu n'est pas tout ce qui existe.

              « Allergènes suivis » et non « au bon moment » : sur un sujet de
              santé, une promesse absolue engage plus qu'on ne peut tenir dans
              une pastille de trois mots. */}
          <ul className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              {
                icon: CalendarDays,
                label: `${remainingMonths} mois de repas prévus`,
              },
              { icon: ShieldCheck, label: "Allergènes suivis" },
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
            À cet âge, bébé n'a encore besoin que de lait. Gardez son programme
            {" : "}
            on vous préviendra dès que la diversification pourra commencer.
          </p>
        )}

        {/* Première invitation : juste après la récompense, quand le parent
            vient de voir ce que le programme sait faire — et avant qu'il ait à
            défiler encore. Elle décrit ce que devient son quotidien plutôt que
            ce qu'il perdrait à partir : la menace, le parent l'a comprise seul,
            et le prix n'a rien à faire ici.

            Le tout tenait en une phrase — recette, quantité, texture, rythme,
            allergènes, courses — et l'accumulation noyait le bénéfice. Il est
            maintenant dit en dernier, seul sur sa ligne, parce que c'est lui
            qu'on retient : la décision quotidienne disparaît.

            L'abricot pâle est un fond, pas une couleur de texte : le corps
            reprend donc l'encre de la page (lisible dans les deux thèmes) et
            seul le titre, assez gros pour s'en contenter, porte la teinte. */}
        <section className="mt-8 rounded-2xl bg-accent px-6 py-8 text-center text-foreground">
          <h2 className="font-heading text-xl font-semibold text-balance text-accent-foreground md:text-2xl">
            Et demain ? Tout est déjà prévu.
          </h2>
          <p className="mx-auto mt-3 max-w-md leading-relaxed">
            Chaque jour, retrouvez le prochain repas de {setup.prenom}, avec{" "}
            <strong className="font-semibold">
              les bonnes quantités, la texture adaptée et la préparation pas à
              pas
            </strong>
            .
          </p>
          <p className="mx-auto mt-3 max-w-md leading-relaxed">
            Les nouvelles découvertes s'enchaînent progressivement, les
            allergènes sont suivis, et votre liste de courses se prépare à
            partir des repas prévus.
          </p>
          <p className="mx-auto mt-5 max-w-md font-heading font-semibold text-balance text-accent-foreground">
            Vous n'avez plus à vous demander chaque jour par quoi continuer.
          </p>
          <SignUpLink className="mt-6">
            Garder le programme de {setup.prenom}
          </SignUpLink>
          <p className="mt-3 text-sm text-muted-foreground">
            Votre compte gratuit permet de sauvegarder son programme
          </p>
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
                essaie de toucher quand on voit un cadenas.

                « Et N jours de plus » comptait du contenu ; « N jours sont déjà
                prévus pour lui » compte des décisions que le parent n'aura pas
                à prendre. Même chiffre, et c'est le second des deux qui lui
                enlève quelque chose. */}
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
                    {daysBeyondPreview} jours sont déjà prévus pour{" "}
                    {setup.prenom}, jusqu'en {monthFmt.format(firstBirthday)}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    Repas, quantités, textures et courses{" : "}
                    le programme garde le fil pour vous.
                  </span>
                  <span className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-primary">
                    Voir tout le programme
                    <ArrowRight className="size-4 shrink-0" />
                  </span>
                </span>
              </Link>
            )}
          </section>
        )}

        {/* L'objection qui décide de tout, et qu'aucun argument de contenu ne
            désarme : « je ne tiendrai jamais un programme de huit mois ». On y
            répond en retirant l'engagement — il n'y a qu'un repas à regarder,
            celui de demain — puis en montrant les trois écarts du quotidien
            comme des gestes d'une ligne, et non comme une fonctionnalité de
            « réajustement » que le parent devrait apprendre. */}
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            Un fil conducteur jusqu'à son premier anniversaire.
          </h2>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Pas besoin de préparer les {remainingMonths} prochains mois
            aujourd'hui. Petite Cuillère vous montre simplement{" "}
            <strong className="font-semibold text-foreground">
              le prochain repas
            </strong>
            , puis le suivant, en avançant au rythme de {setup.prenom}.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Et parce que les journées avec un bébé ne se passent pas toujours
            comme prévu{" :"}
          </p>
        </section>

        {/* Les quatre charges que le parent n'a plus à porter. Titre d'abord,
            explication ensuite : c'est une section qui se scanne, on ne lit la
            deuxième ligne que si la première a accroché. */}
        <section className="mt-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance">
            Vous n'avez pas à tout garder en tête.
          </h2>
          <ul className="mt-6 space-y-5">
            {perks.map((perk) => (
              <li key={perk.title} className="flex items-start gap-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <perk.icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-heading font-semibold">
                    {perk.title}
                  </span>
                  <span className="mt-0.5 block leading-snug text-muted-foreground">
                    {perk.body}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Invitation finale — jamais un mur brutal. Le titre constate puis
            demande, dans cet ordre : ce qui est prêt existe déjà, il ne reste
            qu'à ne pas le perdre.

            « Vos réponses sont déjà enregistrées » remonte juste sous le
            bouton, parce que c'est là que se pose la dernière question du
            parent — « si je clique, est-ce que je dois tout retaper ? ». */}
        <section
          ref={finalCtaRef}
          className="mt-12 rounded-2xl bg-primary px-6 py-10 text-center text-primary-foreground"
        >
          <span className="mx-auto grid size-12 place-items-center rounded-md bg-primary-foreground/15">
            <Lock className="size-6" />
          </span>
          <h2 className="mt-5 font-heading text-2xl font-semibold tracking-tight text-balance">
            Le programme de {setup.prenom} est prêt. Gardez-le.
          </h2>
          <p className="mx-auto mt-4 max-w-md leading-relaxed text-primary-foreground/90">
            Créez votre compte gratuit pour retrouver ses prochains repas,
            enregistrer ce qu'{subjectPronoun(setup.sexe)} mange et partager son
            suivi avec les personnes qui s'en occupent.
          </p>
          <SignUpLink tone="inverse" className="mt-7">
            Garder le programme de {setup.prenom}
          </SignUpLink>
          <p className="mt-3 text-sm text-primary-foreground/75">
            Gratuit · sans publicité
          </p>
          <p className="mt-1 text-sm text-primary-foreground/75">
            Vos réponses sont déjà enregistrées{" : "}
            vous n'aurez rien à ressaisir.
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
            <SignUpLink className="w-full">
              Garder le programme de {setup.prenom}
            </SignUpLink>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Crée votre compte gratuit
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
