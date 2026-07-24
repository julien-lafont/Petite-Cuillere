import Link from "next/link";
import type { Metadata } from "next";
import {
  Soup,
  ShoppingBasket,
  Sprout,
  Snowflake,
  Users,
  ShieldCheck,
  ArrowRight,
  Check,
  Heart,
  Sparkles,
  Salad,
  Droplets,
  ShieldAlert,
} from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

const TITLE =
  "Petite Cuillère — Les premiers repas de bébé, en toute confiance";
const DESCRIPTION =
  "Chaque jour, on vous dit quoi cuisiner pour bébé, comment et en quelle quantité. De 4 à 12 mois, fondé sur les recommandations des autorités de santé. Gratuit.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // La canonique se pose ici et non dans le layout racine : y mettre « / »
  // désignerait la landing comme canonique de toutes les pages du site.
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: TITLE, description: DESCRIPTION },
  twitter: { title: TITLE, description: DESCRIPTION },
};

/**
 * Landing publique. Prolonge le design system « Petite Cuillère » (cf.
 * docs/ux-redesign.md §7) : les sections montrent le vrai produit — la fiche du
 * jour, le bandeau de la semaine — plutôt que des visuels abstraits. Le récit
 * suit la journée du parent, puis sa semaine.
 *
 * Les CTA pointent vers `/decouvrir` : le programme se voit sans compte
 * (cf. §3.5), c'est l'argument le plus fort de la page — il est donc répété
 * dans le hero, dans « comment ça marche » et dans le bloc de clôture.
 *
 * Les contenus reproduits ici sont figés à la main. Quand les textes de
 * `lib/program/stage.ts` (stades, changements) évoluent, penser à réaligner le
 * bandeau de `WeeklyBriefing` pour que la promesse reste fidèle au produit.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <DayInApp />
        <WeeklyBriefing />
        <HowItWorks />
        <Reassurance />
        <BatchAndShare />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ header */

function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <BrandMark />
        <Link
          href="/login"
          className="rounded-md px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Se connecter
        </Link>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* halo doux, décoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 size-[32rem] rounded-full bg-secondary/60 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-40 size-96 rounded-full bg-novelty-soft/50 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:gap-8 md:px-8 md:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Diversification alimentaire · 4 à 12 mois
          </p>
          <h1 className="mt-4 font-heading text-[2.6rem] font-semibold leading-[1.05] tracking-tight text-balance md:text-6xl">
            Bébé est prêt à découvrir le&nbsp;monde.
            <span className="text-primary"> On s&apos;occupe du menu.</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            Un programme de repas complet jusqu&apos;au premier anniversaire.
            Chaque matin, Petite Cuillère vous dit quoi préparer, comment et en
            quelle quantité. Vous n&apos;avez plus qu&apos;à sortir le
            cuiseur-vapeur.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/decouvrir"
              className="inline-flex h-13 items-center gap-2 rounded-md bg-primary px-6 text-base font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5"
            >
              Voir le programme de bébé
              <ArrowRight className="size-5" />
            </Link>
            <span className="text-sm text-muted-foreground">
              Gratuit · sans compte
            </span>
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
            {[
              "Quelques questions, et c'est prêt",
              "Fondé sur les recommandations santé",
              "Partagé avec toute la famille",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className="size-4 text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Preuve : la vraie fiche du jour */}
        <div className="relative mx-auto w-full max-w-sm">
          <HeroMealCard />
        </div>
      </div>
    </section>
  );
}

/** Reproduction fidèle de la fiche « Aujourd'hui », comme preuve du produit. */
function HeroMealCard() {
  return (
    <div className="rotate-1 rounded-lg border bg-card p-5 shadow-lifted">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Aujourd&apos;hui
          </p>
          <p className="font-heading text-lg font-semibold">
            Le déjeuner de Léa
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-novelty px-2.5 py-1 text-xs font-semibold text-novelty-foreground">
          <span className="size-1.5 rounded-full bg-current" />
          nouveauté
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t pt-3">
        <span className="font-heading text-base font-semibold">
          La courgette
        </span>
        <span className="text-sm font-medium text-muted-foreground">
          ~120 g · lisse
        </span>
      </div>

      <ol className="mt-3 space-y-2 text-sm">
        {[
          "Épluche, épépine et coupe en dés.",
          "Cuis à la vapeur 12 min.",
          "Mixe en purée bien lisse.",
          "1 c. à café d'huile de colza, hors cuisson.",
        ].map((step, i) => (
          <li key={i} className="flex gap-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {i + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-4 flex items-start gap-2 rounded-md bg-accent px-3 py-2.5 text-sm text-accent-foreground">
        <Snowflake className="mt-0.5 size-4 shrink-0" />
        <span>
          Revient 5 fois ce mois-ci — congelez 4 portions d&apos;avance.
        </span>
      </div>

      {/* Le geste du soir : noter le repas en un tap */}
      <div className="mt-4 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">
          Ça s&apos;est passé comment&nbsp;?
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs font-medium">
          <span className="rounded-md border border-primary bg-primary/12 py-2 text-primary">
            <span aria-hidden>😋</span> adoré
          </span>
          <span className="rounded-md border py-2 text-muted-foreground">
            <span aria-hidden>😐</span> moyen
          </span>
          <span className="rounded-md border py-2 text-muted-foreground">
            <span aria-hidden>🙅</span> refusé
          </span>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- day in app */

function DayInApp() {
  const moments = [
    {
      icon: Soup,
      eyebrow: "Le matin, en cuisine",
      title: "Quoi préparer, là, maintenant",
      body: "La recette du jour pas à pas, avec la quantité et la texture déjà calculées pour l'âge de bébé. Le soir, un tap suffit pour dire si ça a plu.",
    },
    {
      icon: ShoppingBasket,
      eyebrow: "Avant les courses",
      title: "Une liste déjà remplie",
      body: "Les ingrédients de la semaine — ou du mois — en quantités d'achat concrètes : 4 courgettes, 1 kg de carottes. Sans conversion à faire dans le rayon.",
    },
    {
      icon: Sprout,
      eyebrow: "Pour le suivi",
      title: "Ce que bébé a déjà goûté",
      body: "Les aliments découverts, les allergènes introduits un par un et les réactions notées. Et le recul : diversité, aliments préférés, catégories couvertes.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Une journée avec Petite Cuillère
        </p>
        <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Toujours la bonne info, au bon moment
        </h2>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {moments.map((m) => (
          <article
            key={m.title}
            className="flex flex-col rounded-lg border bg-card p-6 shadow-soft"
          >
            <span className="grid size-12 place-items-center rounded-md bg-secondary text-secondary-foreground">
              <m.icon className="size-6" />
            </span>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {m.eyebrow}
            </p>
            <h3 className="mt-1.5 font-heading text-xl font-semibold">
              {m.title}
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {m.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------- weekly briefing */

function WeeklyBriefing() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 md:px-8 md:pb-24">
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Chaque semaine
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Vous savez toujours pourquoi, pas seulement quoi
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Un programme qui ne s&apos;explique pas, ça ne se suit pas
            longtemps. Chaque semaine, Petite Cuillère vous dit où en est bébé,
            ce qui change dans les repas — un créneau qui s&apos;ouvre, une
            texture qui monte, une nouvelle catégorie d&apos;aliments — et la
            raison derrière chaque évolution.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Les semaines où rien ne bouge, la place est prise par un conseil
            utile plutôt que par du remplissage.
          </p>
        </div>

        <BriefingCard />
      </div>
    </section>
  );
}

/** Reproduction du bandeau « Cette semaine » de l'écran Ma semaine. */
function BriefingCard() {
  const changes = [
    {
      icon: Salad,
      title: "Les féculents entrent au menu",
      detail:
        "Environ un quart de la portion de légumes : les glucides complexes couvrent 40 à 50 % des besoins en énergie.",
    },
    {
      icon: Droplets,
      title: "Une cuillère d'huile par repas salé",
      detail:
        "1 c. à café d'huile de colza, ajoutée hors cuisson, pour les acides gras essentiels.",
    },
    {
      icon: ShieldAlert,
      title: "Un allergène à la fois",
      detail:
        "Espacé de trois jours du précédent, pour repérer une réaction sans ambiguïté.",
    },
  ];

  return (
    <div className="rounded-xl border border-primary/15 bg-secondary/45 p-5 shadow-soft md:-rotate-1">
      <p className="text-sm font-medium text-secondary-foreground">
        Cette semaine · 6 mois et 1 sem.
      </p>
      <h3 className="mt-0.5 font-heading text-xl font-semibold tracking-tight">
        Féculents et matière grasse
      </h3>
      <p className="mt-1.5 text-foreground/85">
        Le midi se complète d&apos;un féculent, et chaque repas salé reçoit sa
        cuillère d&apos;huile. Le lait reste la base&nbsp;: 500 à 750 mL par
        jour.
      </p>

      <ul className="mt-4 space-y-3 border-t border-primary/15 pt-4">
        {changes.map((c) => (
          <li key={c.title} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-soft">
              <c.icon className="size-4" />
            </span>
            <p className="text-sm">
              <span className="font-semibold">{c.title}.</span>{" "}
              <span className="text-muted-foreground">{c.detail}</span>
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <span>
          3 découvertes cette semaine&nbsp;: patate douce, poulet et abricot.
        </span>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- how it works */

function HowItWorks() {
  const steps = [
    {
      title: "Quelques questions sur bébé",
      body: "Son prénom, sa date de naissance, et si la diversification a déjà commencé. Si oui, on récupère en quelques touches tout ce qui a déjà été goûté.",
    },
    {
      title: "Le programme s'affiche, sans compte",
      body: "Un calendrier de repas complet, adapté à son âge qui évolue — sans rien à configurer. Le compte ne sert qu'à le garder et à le partager.",
    },
    {
      title: "Vous cuisinez, vous notez, c'est tout",
      body: "Un repas raté ? On s'adapte, sans jamais culpabiliser. Le programme se recale tout seul sur ce qui reste à découvrir.",
    },
  ];

  return (
    <section className="border-y border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Comment ça marche
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Prêt en moins d&apos;une minute
          </h2>
        </div>

        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="font-heading text-5xl font-semibold text-primary/25 tabular-nums">
                {i + 1}
              </span>
              <h3 className="mt-2 font-heading text-xl font-semibold">
                {s.title}
              </h3>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- reassurance */

function Reassurance() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-16 text-center md:px-8 md:py-24">
      <span className="mx-auto grid size-14 place-items-center rounded-lg bg-secondary text-primary">
        <ShieldCheck className="size-7" />
      </span>
      <h2 className="mt-6 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
        Fondé sur les recommandations des autorités de santé
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Ordre d&apos;introduction des aliments, allergènes espacés de trois
        jours, textures selon l&apos;âge, quantités par catégorie, aliments à
        éviter&nbsp;: chaque repas suit les repères des sociétés de pédiatrie.
        Aucune place laissée à l&apos;improvisation.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------- batch & share */

function BatchAndShare() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-8 md:px-8">
      <div className="grid gap-5 md:grid-cols-2">
        <article className="rounded-lg border bg-card p-8 shadow-soft">
          <span className="grid size-12 place-items-center rounded-md bg-accent text-accent-foreground">
            <Snowflake className="size-6" />
          </span>
          <h3 className="mt-5 font-heading text-2xl font-semibold">
            Cuisinez une fois, servez tout le mois
          </h3>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Passez la liste de courses en vue mensuelle&nbsp;: Petite Cuillère
            repère les aliments qui reviennent souvent et vous dit combien de
            portions préparer et congeler. Le batch cooking, sans y penser.
          </p>
        </article>

        <article className="rounded-lg border bg-card p-8 shadow-soft">
          <span className="grid size-12 place-items-center rounded-md bg-secondary text-secondary-foreground">
            <Users className="size-6" />
          </span>
          <h3 className="mt-5 font-heading text-2xl font-semibold">
            Toute la famille au diapason
          </h3>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Le co-parent, les grands-parents, la nounou&nbsp;: chacun voit le
            même programme et note les repas — sans mot de passe à retenir, un
            code à six chiffres reçu par email suffit. Et s&apos;il y a
            plusieurs enfants à la maison, chacun a le sien.
          </p>
        </article>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- closing cta */

function ClosingCta() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground md:py-20">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-72 rounded-full bg-primary-foreground/10 blur-2xl"
        />
        <h2 className="relative font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Les premiers repas de bébé, en toute confiance
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-lg text-primary-foreground/85">
          Gratuit, pour toujours. Sans limite, sans publicité, sans frais caché.
        </p>
        <Link
          href="/decouvrir"
          className="relative mt-8 inline-flex h-13 items-center gap-2 rounded-md bg-background px-7 text-base font-semibold text-foreground shadow-soft transition-transform hover:-translate-y-0.5"
        >
          Voir le programme, sans compte
          <ArrowRight className="size-5" />
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ footer */

function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center md:px-8">
        <BrandMark />
        <p className="flex max-w-xl items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <Heart aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          Conçu par une maman et un papa, pour leur merveilleux Mathis et pour
          tous les petits gourmets qui découvrent le monde.
        </p>
      </div>
    </footer>
  );
}
