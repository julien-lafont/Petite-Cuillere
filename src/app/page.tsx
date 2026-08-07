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
  Sparkles,
  Salad,
  Droplets,
  ShieldAlert,
  Ban,
  Replace,
  CalendarX2,
  RefreshCw,
  Leaf,
  BookOpen,
  Baby,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const TITLE =
  "Petite Cuillère — Les premiers repas de bébé, en toute confiance";
const DESCRIPTION =
  "Chaque jour, le repas de bébé prêt à cuisiner : quoi lui donner, en quelle quantité, à quelle texture. De 4 à 12 mois, allergènes compris, d'après les recommandations officielles. Gratuit.";

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
 * jour, la bande de rattrapage, le bandeau de la semaine — plutôt que des
 * visuels abstraits. Le récit suit la journée du parent, puis sa semaine.
 *
 * RÈGLES D'ÉCRITURE, à tenir à chaque retouche :
 *
 *   1. On parle à un parent fatigué, pas à un professionnel de santé. Le
 *      bénéfice d'abord, le mécanisme seulement s'il rassure.
 *   2. Une situation concrète vaut mieux qu'une fonctionnalité nommée
 *      (« il était chez sa grand-mère » plutôt que « gestion des absences »).
 *   3. Pas de tirets cadratins en cascade : deux points, virgule ou point.
 *   4. Jamais d'injonction ni de culpabilisation, y compris implicite.
 *
 * Les CTA pointent vers `/decouvrir` : le programme se voit sans compte
 * (cf. §3.5), c'est l'argument le plus fort de la page. La preuve de sérieux
 * arrive juste après, avec les deux pages `/methode`, publiques elles aussi.
 *
 * Les contenus reproduits ici sont figés à la main. Quand les textes de
 * `lib/program/stage.ts` (stades, changements), `lib/program/diff.ts` (phrases
 * de rattrapage) ou le catalogue d'allergènes évoluent, penser à réaligner les
 * cartes correspondantes pour que la promesse reste fidèle au produit.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <DayInApp />
        <Method />
        <RealLife />
        <WeeklyBriefing />
        <Allergens />
        <HowItWorks />
        <BatchAndShare />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* halo doux, décoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 size-[36rem] rounded-full bg-secondary/60 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-48 size-96 rounded-full bg-novelty-soft/50 blur-3xl"
      />

      {/*
       * La colonne de droite est calée sur la largeur de la fiche (24rem =
       * `max-w-sm`) plutôt que sur une fraction de la grille : sinon la carte se
       * centre dans une colonne trop large et creuse un vide entre le titre et
       * elle, en plus de la gouttière.
       */}
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 md:grid-cols-2 md:gap-8 md:px-8 md:py-32 lg:grid-cols-[1fr_24rem] lg:gap-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Diversification alimentaire · 4 à 12 mois
          </p>
          <h1 className="mt-5 font-heading text-[2.75rem] font-semibold leading-[1.04] tracking-tight text-balance md:text-[4.25rem]">
            Bébé est prêt à découvrir le monde.
            <span className="text-primary"> On s'occupe du menu.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">
            Quoi lui donner aujourd'hui, en quelle quantité, à quelle texture,
            et quand lui faire goûter l'arachide. Petite Cuillère répond à tout
            ça pour vous, un jour après l'autre, jusqu'à son premier
            anniversaire.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
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

          <ul className="mt-10 space-y-2.5">
            {[
              "Prêt en quelques questions",
              "Écrit d'après les recommandations officielles",
              "Il s'adapte quand la journée dérape",
              "Partagé avec tous ceux qui le nourrissent",
            ].map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-[0.95rem] text-muted-foreground"
              >
                <Check className="size-4 shrink-0 text-primary" />
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
            Aujourd'hui
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
        <span>Revient 5 fois ce mois-ci, congelez 4 portions d'avance.</span>
      </div>

      {/* Le geste du soir : noter le repas en un tap. */}
      <div className="mt-4 border-t pt-3">
        <p className="text-xs font-medium text-muted-foreground">
          Ça s'est passé comment ?
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
      body: "La recette du jour, étape par étape, avec la quantité et la texture déjà calculées pour son âge. Ce qui passe à la vapeur, ce qui cuit à part, ce qui se sert nature : tout est écrit.",
    },
    {
      icon: ShoppingBasket,
      eyebrow: "Avant les courses",
      title: "Une liste déjà prête",
      body: "Tout ce dont la semaine a besoin, en quantités d'achat : 4 courgettes, 1 kg de carottes. Plus de calcul mental dans le rayon fruits et légumes.",
    },
    {
      icon: Sprout,
      eyebrow: "Pour le suivi",
      title: "Ce qu'il a déjà goûté",
      body: "Les aliments découverts, les allergènes introduits, les réactions notées. De quoi répondre au pédiatre sans fouiller dans votre mémoire.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Une journée avec Petite Cuillère
        </p>
        {/* Titre volontairement court : il doit tenir sur une ligne en desktop. */}
        <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          La bonne info, pile quand il faut
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

/* ------------------------------------------------------------------ méthode */

/**
 * La preuve de sérieux, placée haut : c'est ce qui sépare Petite Cuillère d'un
 * menu trouvé sur un forum. Les deux pages liées sont publiques (cf.
 * `app/methode/layout.tsx`) — on ne demande pas de créer un compte pour
 * vérifier nos sources.
 */
function Method() {
  const sources = [
    "PNNS 4",
    "ESPGHAN",
    "OMS",
    "Étude LEAP",
    "Étude EAT",
    "Cohorte ELFE",
  ];

  const pages = [
    {
      href: "/methode",
      title: "Comment le programme est construit",
      description:
        "L'ordre des légumes, l'ouverture des repas, l'âge des premiers morceaux.",
    },
    {
      href: "/methode/allergenes",
      title: "Comment les allergènes sont introduits",
      description:
        "Pourquoi tôt, à quelle dose, et pourquoi il faut continuer après.",
    },
  ];

  return (
    <section className="border-y border-border/60 bg-secondary/30">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-24">
        <div className="max-w-2xl">
          <span className="grid size-12 place-items-center rounded-md bg-card text-primary shadow-soft">
            <ShieldCheck className="size-6" />
          </span>
          <h2 className="mt-5 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Rien n'est inventé, et tout est vérifiable
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Les repas de votre bébé ne sortent pas du chapeau. Ils suivent les
            mêmes textes que ceux dont vous parle votre pédiatre : le programme
            national nutrition santé, la société européenne de
            gastro-entérologie pédiatrique, l'OMS, et les grandes études sur les
            allergènes.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Vous n'êtes pas obligé de nous croire sur parole. Deux pages, en
            accès libre, détaillent la méthode principe par principe, chiffres
            et sources à l'appui.
          </p>
        </div>

        <div className="mt-9 grid gap-4 sm:grid-cols-2">
          {pages.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex items-start gap-3.5 rounded-lg border bg-card p-5 shadow-soft transition-colors hover:border-primary/40"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
                <BookOpen className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-lg font-semibold underline-offset-4 group-hover:underline">
                  {p.title}
                </span>
                <span className="mt-1 block leading-relaxed text-muted-foreground">
                  {p.description}
                </span>
              </span>
              <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Nos sources :</span>
          {sources.map((s) => (
            <span
              key={s}
              className="rounded-full border bg-card px-3 py-1 text-sm font-medium text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- real life */

/**
 * Le suivi réel et le rattrapage (docs/feats/suivi-reel-et-rattrapage.md). La
 * section répond à l'objection numéro un du parent, celle qui décide de tout :
 * « je ne tiendrai jamais un programme ». D'où des situations vécues en
 * ouverture, et le nom des fonctionnalités seulement après.
 */
function RealLife() {
  const gestures = [
    {
      icon: Ban,
      title: "Il n'a rien mangé",
      body: "Repas chez la nounou, sieste qui déborde, appétit aux abonnés absents. Vous le signalez d'un geste et on n'en parle plus.",
    },
    {
      icon: Replace,
      title: "Il a mangé autre chose",
      body: "Un reste, un petit pot, une purée improvisée. Dites ce qu'il a eu pour de vrai : si c'était une découverte, elle compte, et elle revient demain.",
    },
    {
      icon: RefreshCw,
      title: "Plus une seule courgette",
      body: "L'app vous propose trois remplaçants qu'il connaît déjà et qui font le même travail. La recette et la liste de courses se mettent à jour.",
    },
    {
      icon: CalendarX2,
      title: "On ne sera pas là",
      body: "Un week-end chez les cousins, une semaine de vacances. Prévenez à l'avance, le programme s'organise sans vous.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <div className="grid items-start gap-12 md:grid-cols-2 md:gap-14">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            La vraie vie
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Un repas sauté ne casse rien
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Il était chez sa grand-mère. Il a tout recraché. Vous avez oublié
            d'acheter le poisson. Ça arrive à toutes les familles, toutes les
            semaines, et c'est précisément là que les jolis plannings finissent
            au fond d'un tiroir.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Chez nous, vous le dites en un geste et le programme se remet
            d'aplomb tout seul. L'aliment manqué retrouve sa place, la suite se
            décale, les courses se recalculent.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Vous ne trouverez ici ni score, ni série à ne pas briser, ni
            pastille rouge. Un repas non renseigné reste un repas non renseigné,
            et personne ne viendra vous le reprocher.
          </p>

          <dl className="mt-9 grid gap-6 sm:grid-cols-2">
            {gestures.map((g) => (
              <div key={g.title}>
                <dt className="flex items-center gap-2 font-heading text-base font-semibold">
                  <g.icon className="size-4 shrink-0 text-primary" />
                  {g.title}
                </dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {g.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <CatchUpCard />
      </div>
    </section>
  );
}

/** Reproduction de la bande de rattrapage d'« Aujourd'hui ». */
function CatchUpCard() {
  const rows = [
    { moment: "Déjeuner", food: "carotte" },
    { moment: "Goûter", food: "pomme" },
  ];

  return (
    <div className="space-y-4 md:sticky md:top-24 md:rotate-1">
      <div className="rounded-lg border bg-card p-5 shadow-lifted">
        <p className="font-heading text-base font-semibold">
          Hier, il vous restait deux repas
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Deux jours en arrière, jamais plus. Au-delà, ce rappel disparaît de
          lui-même : on ne vous fabrique pas du retard.
        </p>

        <ul className="mt-4 space-y-2.5 border-t pt-4">
          {rows.map((r) => (
            <li key={r.moment} className="flex items-center justify-between">
              <span className="text-sm">
                <span className="font-medium">{r.moment}</span>
                <span className="text-muted-foreground"> · {r.food}</span>
              </span>
              <span className="flex items-center gap-1.5 text-base">
                <span aria-hidden>😋</span>
                <span aria-hidden>😐</span>
                <span aria-hidden>🙅</span>
                <Ban aria-hidden className="size-4 text-muted-foreground" />
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 grid h-11 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
          Tout s'est passé comme prévu
        </p>
      </div>

      <div className="flex items-start gap-2.5 rounded-lg bg-accent px-4 py-3 text-sm text-accent-foreground shadow-soft">
        <Sparkles className="mt-0.5 size-4 shrink-0" />
        <span>
          <span className="font-semibold">C'est noté.</span> Le brocoli sera
          reproposé demain, et le reste de la semaine décale d'un jour.
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- weekly briefing */

function WeeklyBriefing() {
  return (
    <section className="border-y border-border/60 bg-secondary/30">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:grid-cols-2 md:gap-14 md:px-8 md:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Chaque semaine
          </p>
          <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            Vous savez toujours pourquoi, pas seulement quoi
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Un programme qu'on ne comprend pas, on finit par l'abandonner. Alors
            chaque semaine, on vous fait le point : où en est votre bébé, ce qui
            change dans ses repas, et la raison de ce changement. Un nouveau
            créneau, une texture qui monte, une catégorie d'aliments qui
            s'ouvre.
          </p>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Les semaines où rien ne bouge, la place revient à un conseil utile
            plutôt qu'à du remplissage.
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
    <div className="rounded-xl border border-primary/15 bg-card p-5 shadow-soft md:-rotate-1">
      <p className="text-sm font-medium text-secondary-foreground">
        Cette semaine · 6 mois et 1 sem.
      </p>
      <h3 className="mt-0.5 font-heading text-xl font-semibold tracking-tight">
        Féculents et matière grasse
      </h3>
      <p className="mt-1.5 text-foreground/85">
        Le midi se complète d'un féculent, et chaque repas salé reçoit sa
        cuillère d'huile. Le lait reste la base : 500 à 750 mL par jour.
      </p>

      <ul className="mt-4 space-y-3 border-t border-primary/15 pt-4">
        {changes.map((c) => (
          <li key={c.title} className="flex gap-3">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
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
          3 découvertes cette semaine : patate douce, poulet et abricot.
        </span>
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- allergènes */

/**
 * Le sujet le plus anxiogène de la diversification, et celui où le produit va
 * le plus loin. On tient deux idées, pas davantage : introduire tôt protège, et
 * l'entretien compte autant que la première cuillère. Tout le détail (doses,
 * fenêtres, contre-indications) vit sur /methode/allergenes — une landing n'est
 * pas le bon endroit pour de la clinique.
 *
 * Le « seize » vient du catalogue (`supabase/reset.sql`, lu par
 * `lib/program/allergens.ts`) : à réaligner si le catalogue change.
 */
function Allergens() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          La question qui revient le plus
        </p>
        <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-balance md:text-4xl">
          Seize allergènes, tous introduits avant son premier anniversaire
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          L'arachide et l'œuf, évidemment. Mais aussi les fruits à coque un par
          un, parce que bien tolérer l'amande ne dit rien de la noix de cajou.
          Et la moutarde, le kiwi et le sarrasin, très présents chez les enfants
          en France et souvent oubliés des listes venues d'ailleurs. Chacun a sa
          période idéale, le calendrier est bâti autour de ces dates, et vous
          n'avez aucune liste à cocher de votre côté.
        </p>
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start md:gap-12">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-1">
          <div className="rounded-lg border bg-card px-6 py-5 shadow-soft">
            <p className="font-heading text-4xl font-semibold text-primary">
              16
            </p>
            <p className="mt-1 leading-snug text-muted-foreground">
              allergènes placés un par un dans ses repas, sans que vous ayez à y
              penser
            </p>
          </div>
          <div className="rounded-lg border bg-card px-6 py-5 shadow-soft">
            <p className="font-heading text-4xl font-semibold text-primary">
              3 fois moins
            </p>
            <p className="mt-1 leading-snug text-muted-foreground">
              d'allergies à un an chez les enfants exposés tôt et régulièrement
              <span className="block text-sm">
                Étude EAT, 1 300 nourrissons suivis
              </span>
            </p>
          </div>
        </div>

        <div className="space-y-7">
          <article>
            <h3 className="font-heading text-xl font-semibold">
              Le conseil a changé, et c'est une bonne nouvelle
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Nos parents devaient repousser l'œuf, l'arachide et le poisson le
              plus tard possible. On sait aujourd'hui que retarder ne protège de
              rien, et que proposer tôt protège beaucoup. C'est l'un des rares
              sujets d'alimentation infantile où la réponse est aussi franche.
              Autant en profiter.
            </p>
          </article>

          <article>
            <h3 className="font-heading text-xl font-semibold">
              Le plus dur, ce n'est pas la première cuillère
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              C'est de continuer. Un allergène bien toléré doit revenir
              régulièrement dans l'assiette pour que la tolérance tienne, et
              c'est le détail que presque tout le monde laisse filer. Petite
              Cuillère les replace pour vous, dans des repas ordinaires, semaine
              après semaine.
            </p>
          </article>

          <Link
            href="/methode/allergenes"
            className="inline-flex items-center gap-2 font-semibold text-primary underline-offset-4 hover:underline"
          >
            Voir le détail du protocole
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- how it works */

function HowItWorks() {
  const steps = [
    {
      title: "Quelques questions sur lui",
      body: "Son prénom, sa date de naissance, et où il en est. S'il a déjà commencé, vous cochez ce qu'il a goûté et on repart de là.",
    },
    {
      title: "Son programme s'affiche, sans compte",
      body: "Un calendrier de repas complet, adapté à son âge, sans rien à régler. Le compte sert seulement à le garder et à le partager.",
    },
    {
      title: "Vous cuisinez, vous notez, c'est tout",
      body: "Le reste se met à jour tout seul : les prochaines découvertes, les courses de la semaine, le suivi des allergènes.",
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
            Prêt en moins d'une minute
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

        <div className="mt-12 flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-soft sm:flex-row sm:items-start sm:gap-5 md:p-8">
          <span className="grid size-12 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
            <Baby className="size-6" />
          </span>
          <div>
            <h3 className="font-heading text-xl font-semibold">
              Vous commencez à sept mois ? Il n'est pas en retard.
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              Un bébé de sept mois qui découvre sa première carotte n'en est pas
              au même point qu'un bébé du même âge qui mange à la cuillère
              depuis trois mois. Ses premières semaines avancent donc
              tranquillement, puis il rejoint le rythme de son âge en un mois et
              demi environ. Les textures, les allergènes et le fer, eux, restent
              calés sur son âge : ceux-là ont un vrai rendez-vous à respecter.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- batch & share */

function BatchAndShare() {
  const cards = [
    {
      icon: Snowflake,
      tone: "bg-accent text-accent-foreground",
      title: "Cuisinez une fois, servez tout le mois",
      body: "En vue mensuelle, la liste de courses repère les aliments qui reviennent souvent et vous dit combien de portions préparer d'avance. Le batch cooking sans le tableur.",
    },
    {
      icon: Leaf,
      tone: "bg-secondary text-secondary-foreground",
      title: "De saison, ou surgelé sans culpabiliser",
      body: "Chaque aliment vous dit si c'est le bon moment. Fraises en juin, épinards surgelés en février : les deux sont de bonnes réponses, et personne ne vous jugera.",
    },
    {
      icon: Users,
      tone: "bg-secondary text-secondary-foreground",
      title: "Tout le monde à la même page",
      body: "Le co-parent, les grands-parents, la nounou : chacun voit le même programme et note les repas. Pas de mot de passe à retenir, un code reçu par email suffit. Et s'il y a deux enfants à la maison, chacun a le sien.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:pb-8 md:pt-24">
      <div className="grid gap-5 md:grid-cols-3">
        {cards.map((c) => (
          <article
            key={c.title}
            className="rounded-lg border bg-card p-7 shadow-soft"
          >
            <span
              className={`grid size-12 place-items-center rounded-md ${c.tone}`}
            >
              <c.icon className="size-6" />
            </span>
            <h3 className="mt-5 font-heading text-xl font-semibold">
              {c.title}
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {c.body}
            </p>
          </article>
        ))}
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
        <p className="relative mx-auto mt-3 max-w-2xl text-lg text-primary-foreground/85">
          Gratuit, pour toujours. Sans limite, sans publicité, sans frais caché.
          Et fondé sur la science, pas sur des on-dit.
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
