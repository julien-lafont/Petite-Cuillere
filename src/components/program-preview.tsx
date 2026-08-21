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
 * The following days shown as summaries. A whole week: it is the unit a parent
 * thinks their shopping and menus in, and six two-line rows fit on one screen —
 * it was not this summary that pushed the invitation out of view, but the
 * detailed cards that used to take its place.
 */
const SUMMARY_DAYS = 6;

/**
 * The conversion gesture, written once: the same word and the same destination
 * everywhere. Two tones, depending on the background it sits on.
 *
 * That word is "garder le programme", never "créer mon compte". At that point in
 * the read the parent has just seen something that already belongs to them; the
 * account is not what they came for, only the means of not losing it. The
 * mention of a free account drops one rank, into the caption under the button.
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
          ? "bg-primary text-primary-foreground shadow-primary"
          : "bg-background text-foreground shadow-soft",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-5 shrink-0" />
    </Link>
  );
}

/** New-food chip on a summarised day — same styling as `NoveltyPill`. */
function NoveltyCount({ count }: { count: number }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-novelty-soft px-2.5 py-1 text-xs font-bold text-novelty">
      <span className="size-1.5 rounded-full bg-current" />
      {count === 1 ? "1 nouveauté" : `${count} nouveautés`}
    </span>
  );
}

/**
 * Programme preview without an account (decision D3): the first day is shown in
 * full — that is the reward — the following days as summaries. Nothing is
 * editable and nothing is rated: creating the account unlocks all of that.
 *
 * ── Where the invitations to sign up are ───────────────────────────────────
 * There used to be one, right at the bottom, after a week of detailed meals: on
 * mobile, two or three screens of scrolling separated the reward from the
 * gesture we want from the parent. It now sits in four places, each at a
 * different moment of the read:
 *
 *   the header          sticky, visible from the first second (large screen);
 *   the bottom bar      its touch equivalent, under the thumb, throughout the
 *                       scroll — it hides when the final block arrives, so the
 *                       same button is not doubled;
 *   right after day     the parent has just seen what they will get: that is
 *   one                 when the pull is strongest, and when the loss is felt;
 *   the final block     the conclusion, after the through-line and the four
 *                       burdens lifted, for whoever read it all.
 *
 * The same wording everywhere — "garder le programme", not "créer mon compte".
 * The account is not what the parent came for: it is only the way not to lose
 * what the page has just shown them.
 *
 * The following days stay a full week, but summarised to one line of foods
 * each: the detail of the recipes is what the account unlocks, and spreading it
 * out here pushed the invitation off screen without teaching anything more.
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

  // How long there is left to support: it is the page's central argument, and
  // better true for this child than rounded to "8 mois".
  const remainingDays = daysUntilFirstBirthday(birth);
  const remainingMonths = Math.max(1, Math.round(remainingDays / 30.44));
  const firstBirthday = new Date(birth);
  firstBirthday.setFullYear(firstBirthday.getFullYear() + 1);

  // Occurrences per food over the whole period — feeds the freezing hint.
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
   * The summarised days: the day's foods, deduplicated and in meal order, plus
   * the number of discoveries. New foods are counted as we go — a food seen on
   * day 2 is no longer new on day 3.
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
   * The bottom bar hides itself as soon as the final block enters the screen:
   * the same button twice, ten pixels apart, is noise. `inert` rather than
   * `aria-hidden` alone — a link that is hidden but still keyboard-focusable is
   * a trap for anyone navigating by tab.
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
   * What is left to discover once the preview ends — counted from the last day
   * shown and not from today: the programme may start later, and announcing a
   * wrong figure at the moment we ask for the parent's trust would be the worst
   * place to be wrong.
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
   * Days with a baby never go as planned, and that is where a programme gets
   * lost. Three situations the parent recognises before they have finished
   * reading them — rather than a feature word like "réajustement", which reminds
   * them of nothing they have lived.
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
   * What the parent no longer has to carry, one burden per line. The title
   * carries the benefit, the line below says only how it is taken away: strung
   * together in one sentence, as before, it was the benefit that got diluted.
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
          {/* On mobile this button sits at the bottom of the screen, under the thumb. */}
          <Link
            href="/login"
            className="hidden h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 md:inline-flex"
          >
            Garder son programme
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 pt-10 pb-32 md:px-8 md:pb-16">
        <div className="text-center">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
            Le programme de {setup.prenom}
          </p>
          {/* The parent has just answered a questionnaire: they are not waiting
              for a product pitch, they are waiting to see what they got. So the
              title names the thing produced, not the next step — "here is where
              to start" could have been written before we knew the child at
              all. */}
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {firstDay
              ? "Le premier repas est prêt."
              : "Son programme est prêt à démarrer."}
          </h1>
          <p className="mt-3 text-muted-foreground">
            Construit pour ses {ageMonths} mois, et pour ce qu'
            {subjectPronoun(setup.sexe)} a déjà goûté.
          </p>

          {/* What the page does not show yet: the programme's depth. Three
              proofs, on the first screen, so the parent knows the preview is not
              all there is.

              "Allergènes suivis" and not "au bon moment": on a health topic, an
              absolute promise commits to more than a three-word chip can
              keep. */}
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
              <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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

        {/* First invitation: right after the reward, when the parent has just
            seen what the programme can do — and before they have to scroll
            again. It describes what their day becomes rather than what they
            would lose by leaving: the parent worked the threat out on their own,
            and the price has no business here.

            It all used to fit in one sentence — recipe, quantity, texture,
            rhythm, allergens, shopping — and the pile-up drowned the benefit. It
            is now said last, alone on its line, because it is the part that
            sticks: the daily decision disappears.

            The pale apricot is a background, not a text colour: the body
            therefore takes the page's ink (readable in both themes) and only the
            title, large enough to carry it, takes the hue. */}
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
              <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
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

            {/* The rest of the programme, shown for what it is: present, ready,
                and behind the account. Clickable — it is the first thing anyone
                tries to touch when they see a padlock.

                "Et N jours de plus" counted content; "N jours sont déjà prévus
                pour lui" counts decisions the parent will not have to make. Same
                figure, and it is the second one that takes something off their
                plate. */}
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

        {/* The objection that decides everything, and that no content argument
            disarms: "je ne tiendrai jamais un programme de huit mois". We answer
            it by removing the commitment — there is only one meal to look at,
            tomorrow's — then by showing the three everyday divergences as
            one-line gestures, rather than as a "réajustement" feature the parent
            would have to learn. */}
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

        {/* The four burdens the parent no longer carries. Title first,
            explanation second: this is a section people scan, and the second line
            is only read if the first caught them. */}
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

        {/* Final invitation — never a hard wall. The title states, then asks,
            in that order: what is ready already exists, all that is left is not
            to lose it.

            "Vos réponses sont déjà enregistrées" moves right under the button,
            because that is where the parent's last question comes up — "if I
            click, do I have to retype everything?". */}
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

        {/* A parent who already has an account has nothing to "create":
            without this line their only path is clicking a button that does not
            speak to them. */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {"Déjà un compte ? "}
          <Link href="/login" className="font-semibold underline">
            Se connecter
          </Link>
        </p>
      </main>

      {/* The touch equivalent of the header: the one place a thumb reaches
          without changing grip. It slides off screen when the final block
          appears. */}
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
