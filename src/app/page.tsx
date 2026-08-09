import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Heart,
  HelpCircle,
  Mic,
  Plus,
  Repeat,
  Utensils,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";
import { cn } from "@/lib/utils";

const TITLE = "Petite Cuillère — Le repas de bébé, chaque jour, sans y penser";
const DESCRIPTION =
  "Le programme de diversification de votre bébé, jour par jour, de 4 à 12 mois : quoi cuisiner, quantité, texture, allergènes compris. Gratuit, sans compte, fondé sur les recommandations officielles.";

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
 * Landing publique. Direction « le marché du matin » (cf. globals.css) : fond
 * lait, blocs épinard, taches abricot, titres en display serré. Les sections
 * montrent le vrai produit — la fiche du jour, le calendrier des découvertes —
 * plutôt que des visuels abstraits.
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
 * arrive juste après, avec les deux pages de méthode, publiques elles aussi
 * (`src/lib/routes.ts`).
 *
 * Les contenus reproduits ici sont figés à la main. Quand les textes de
 * `lib/program/stage.ts` (stades, changements), `lib/program/diff.ts` (phrases
 * de rattrapage), `components/voice-examples.tsx` (les exemples de dictée),
 * `components/voice-intent-block.tsx` (la carte de confirmation) ou le
 * catalogue d'allergènes évoluent, penser à réaligner les cartes
 * correspondantes pour que la promesse reste fidèle au produit.
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <RevealScript />
      <SiteHeader />
      <main>
        <Hero />
        <DiscoveryRail />
        <Daily />
        <Allergens />
        <RealLife />
        <Voice />
        <Proof />
        <HowItWorks />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </div>
  );
}

/* --------------------------------------------------------------- primitives */

/**
 * Amorce des apparitions au défilement. Écrit en JavaScript inline plutôt qu'en
 * composant client : la page est entièrement statique, et charger un bundle
 * React pour observer des intersections serait hors de proportion.
 *
 * Deux points importants :
 *
 *   1. La classe `js-reveal` est posée de façon **synchrone**, avant que le
 *      navigateur ne peigne la suite du document — c'est pourquoi le script est
 *      rendu tout en haut du corps de page. Un `useEffect` arriverait après le
 *      premier rendu et ferait clignoter les blocs déjà visibles.
 *   2. L'observateur se désabonne dès qu'un bloc est apparu : l'animation ne se
 *      rejoue pas quand on remonte, une page qui frétille à chaque défilement
 *      est vite pénible.
 */
function RevealScript() {
  const code = `
    (function () {
      if (!("IntersectionObserver" in window)) return;
      document.documentElement.classList.add("js-reveal");
      function start() {
        // Sur un téléphone, un bloc occupe souvent plus d'un écran : exiger
        // 12 % de sa hauteur repoussait l'apparition très loin dans le
        // défilement, et on lisait un vide avant que le texte ne se décide.
        // La marge devient donc positive — le bloc s'anime pendant qu'il monte,
        // avant même d'entrer — et le moindre pixel visible suffit.
        var narrow = window.matchMedia("(max-width: 767px)").matches;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          });
        }, {
          rootMargin: narrow ? "0px 0px 14% 0px" : "0px 0px -8% 0px",
          threshold: narrow ? 0 : 0.12,
        });
        document.querySelectorAll(".reveal").forEach(function (el) {
          io.observe(el);
        });
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", start);
      } else {
        start();
      }
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}

/** Surtitre de section : petite tache abricot, puis le libellé en capitales. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.12em] text-primary">
      <span aria-hidden className="blob size-2.5 shrink-0 bg-apricot" />
      {children}
    </p>
  );
}

function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mt-4 max-w-[24ch] font-heading text-3xl font-bold text-balance md:text-[2.35rem] md:leading-[1.12]",
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** CTA principal. La note l'accompagne toujours : gratuité et absence de compte. */
function PrimaryCta({
  children,
  note,
  className,
}: {
  children: React.ReactNode;
  note?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-3", className)}>
      <Link
        href="/decouvrir"
        className="inline-flex min-h-13 items-center gap-2.5 rounded-full bg-primary px-6 py-3.5 text-base font-bold text-primary-foreground shadow-[0_8px_22px_-8px_var(--primary)] transition-transform hover:-translate-y-0.5 sm:px-7"
      >
        {children}
        <ArrowRight className="size-5" />
      </Link>
      {note && <span className="text-sm text-muted-foreground">{note}</span>}
    </div>
  );
}

/**
 * Bloc de section teinté : le grand rectangle épinard aux angles très arrondis
 * qui rythme la page. Il vit dans la gouttière, d'où la double enveloppe.
 */
function TintedSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-5 md:px-8">
      <section className="rounded-3xl bg-secondary px-6 py-16 md:rounded-4xl md:px-14 md:py-24">
        {children}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  const proofs = [
    "Prêt en quelques questions",
    "D'après les recommandations officielles",
    "S'adapte quand la journée dérape",
    "Se pilote à la voix",
  ];

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-10 pt-16 md:px-8 md:pb-12 md:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
      <div>
        <Eyebrow>Diversification · de 4 à 12 mois · gratuit</Eyebrow>
        {/*
         * `isolate` est indispensable : le surlignage du titre passe derrière le
         * texte (z-index négatif), il lui faut un contexte d'empilement local
         * sous peine de disparaître sous le fond de la page.
         */}
        <h1 className="isolate mt-5 font-heading text-[2.6rem] font-extrabold leading-[1.06] text-balance md:text-[3.6rem]">
          Le repas de bébé, chaque jour,{" "}
          <span className="marker-underline text-primary">sans y penser</span>.
        </h1>
        <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
          Quoi cuisiner, en quelle quantité, à quelle texture, et quand
          introduire chaque allergène. Un programme jour par jour fondé sur les
          recommandations officielles, qui s'adapte quand la vraie vie s'en
          mêle.
        </p>

        <PrimaryCta
          className="mt-9"
          note="Gratuit, sans publicité, sans carte bancaire. Conçu par deux parents pour leur fils, ouvert à tous les autres."
        >
          Créer le programme de mon bébé
        </PrimaryCta>

        <ul className="mt-9 flex flex-wrap gap-2">
          {proofs.map((proof) => (
            <li
              key={proof}
              className="inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-semibold text-muted-foreground"
            >
              <Check className="size-4 shrink-0 text-primary" />
              {proof}
            </li>
          ))}
        </ul>
      </div>

      <div className="reveal relative mx-auto w-full max-w-[25rem] lg:ml-auto lg:mr-0">
        {/* Tache décorative glissée derrière l'angle de la fiche. */}
        <span
          aria-hidden
          className="blob absolute -left-4 -top-4 -z-10 size-20 bg-secondary"
        />
        <TodayCard />
      </div>
    </section>
  );
}

/** Reproduction fidèle de la fiche « Aujourd'hui », comme preuve du produit. */
function TodayCard() {
  const steps = [
    "Épluchez, épépinez, coupez en dés.",
    "Cuisez à la vapeur 12 minutes.",
    "Mixez en purée bien lisse.",
    "Ajoutez 1 c. à café d'huile de colza.",
  ];

  return (
    <div className="rounded-3xl border bg-card p-6 shadow-lifted">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Aujourd'hui · déjeuner
      </p>
      <p className="mt-1 font-heading text-lg font-bold">
        Le déjeuner de Léa
        <span className="ml-2 inline-block rounded-full bg-novelty-soft px-2.5 py-0.5 align-middle text-xs font-bold text-novelty">
          Nouveauté
        </span>
      </p>

      <div className="mt-5 flex items-baseline justify-between gap-3 border-b border-dashed pb-3">
        <span className="font-heading text-2xl font-bold">La courgette</span>
        <span className="text-sm font-semibold text-muted-foreground">
          ~120 g · lisse
        </span>
      </div>

      <ol className="mt-4 space-y-2.5 text-[0.95rem] text-muted-foreground">
        {steps.map((step, i) => (
          <li key={step} className="flex items-baseline gap-2.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-xs font-extrabold text-secondary-foreground">
              {i + 1}
            </span>
            <span className="leading-snug">{step}</span>
          </li>
        ))}
      </ol>

      <p className="mt-4 rounded-md bg-secondary px-3.5 py-2.5 text-sm font-semibold text-secondary-foreground">
        <span aria-hidden>💡</span> Revient 5 fois ce mois-ci : congelez 4
        portions d'avance.
      </p>

      {/* Le geste du soir : noter le repas en un tap. */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm text-muted-foreground">
        {[
          { emoji: "😋", label: "Adoré" },
          { emoji: "😐", label: "Moyen" },
          { emoji: "🙅", label: "Refusé" },
        ].map((r) => (
          <span key={r.label} className="rounded-md border py-2 font-medium">
            <span aria-hidden>{r.emoji}</span> {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- frise découvertes */

/**
 * La signature visuelle de la page : le calendrier des découvertes réduit à
 * huit escales. Les couleurs de pastille sont des teintes de fruit choisies une
 * à une, volontairement hors jetons — c'est un objet illustratif, pas un
 * composant d'interface, et le rendu doit rester le même dans les deux thèmes.
 * L'emoji est décoratif : le nom de l'aliment est écrit dessous.
 */
function DiscoveryRail() {
  const stops = [
    { emoji: "🥕", label: "Carotte", age: "4 mois", color: "#F9C784" },
    { emoji: "🥒", label: "Courgette", age: "4 mois ½", color: "#CDE3B0" },
    { emoji: "🥚", label: "Œuf", age: "5 mois", color: "#F6E27F" },
    { emoji: "🥜", label: "Arachide", age: "6 mois", color: "#EFD3B5" },
    { emoji: "🐟", label: "Poisson", age: "6 mois ½", color: "#F2B8A0" },
    { emoji: "🥝", label: "Kiwi", age: "8 mois", color: "#BFE3C0" },
    { emoji: "🍇", label: "Morceaux", age: "9 mois", color: "#E9C9E3" },
    { emoji: "🎂", label: "1 an !", age: "12 mois", color: "#F4A259" },
  ];

  return (
    <section
      aria-label="Aperçu du calendrier des découvertes de 4 à 12 mois"
      className="mx-auto max-w-6xl px-5 pb-6 pt-6 md:px-8 md:pb-8"
    >
      <div className="reveal relative">
        {/* Le rail : masqué en mobile, où les escales passent sur deux rangées. */}
        <span
          aria-hidden
          className="absolute inset-x-[4%] top-[1.65rem] hidden h-0.5 bg-border md:block"
        />
        <ul className="grid grid-cols-4 gap-y-6 md:grid-cols-8">
          {stops.map((stop, i) => (
            <li key={stop.label} className="relative text-center">
              <span
                aria-hidden
                className={cn(
                  "mx-auto grid size-12 place-items-center text-xl shadow-[inset_0_-4px_0_rgb(0_0_0/0.08)]",
                  i % 2 === 0 ? "blob" : "blob-alt",
                )}
                style={{ backgroundColor: stop.color }}
              >
                {stop.emoji}
              </span>
              <span className="mt-2 block text-xs font-bold">{stop.label}</span>
              <span className="block text-xs font-semibold text-muted-foreground">
                {stop.age}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-7 text-center text-sm text-muted-foreground">
        Chaque découverte a sa période idéale. Le calendrier les place pour
        vous, allergènes compris.
      </p>
    </section>
  );
}

/* ---------------------------------------------------------------- quotidien */

function Daily() {
  const cards = [
    {
      kicker: "8 h 30, en cuisine",
      title: "« Je lui prépare quoi ? »",
      body: "La recette du jour, étape par étape. Quantité et texture déjà calculées pour son âge exact.",
    },
    {
      kicker: "Samedi, au supermarché",
      title: "« J'achète quoi ? »",
      body: "4 courgettes, 1 kg de carottes. Pas des grammes par portion à multiplier de tête devant le rayon fruits et légumes.",
    },
    {
      kicker: "Chez le pédiatre",
      title: "« Il a goûté quoi, déjà ? »",
      body: "Aliments découverts, allergènes introduits, réactions notées. Vous répondez au pédiatre sans fouiller dans vos photos.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
      <Eyebrow>Au quotidien</Eyebrow>
      <SectionTitle>Trois questions en moins</SectionTitle>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.kicker}
            className="reveal rounded-lg border bg-card p-7"
          >
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
              {card.kicker}
            </p>
            <h3 className="mt-2.5 font-heading text-xl font-bold">
              {card.title}
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {card.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- allergènes */

/**
 * Le sujet le plus anxiogène de la diversification, et celui où le produit va
 * le plus loin. On tient deux idées, pas davantage : introduire tôt protège, et
 * l'entretien compte autant que la première cuillère. Tout le détail (doses,
 * fenêtres, contre-indications) vit sur la page allergènes — une landing n'est
 * pas le bon endroit pour de la clinique.
 *
 * Le « seize » vient du catalogue (`supabase/reset.sql`, lu par
 * `lib/program/allergens.ts`) : à réaligner si le catalogue change.
 */
function Allergens() {
  return (
    <TintedSection>
      <Eyebrow>Ce qui inquiète le plus les parents</Eyebrow>
      <div className="mt-2 grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <div>
          <SectionTitle className="max-w-[26ch]">
            Les 16 allergènes, introduits au bon moment, sans liste à cocher
          </SectionTitle>
          <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
            Arachide, œuf, fruits à coque un par un… mais aussi la moutarde, le
            kiwi et le sarrasin, fréquents chez les enfants en France. Chacun
            arrive dans les repas à sa période idéale, espacé de 3 jours du
            précédent, puis{" "}
            <strong className="text-foreground">revient régulièrement</strong> :
            c'est la répétition qui installe la tolérance.
          </p>
          <Link
            href={ALLERGENES_URL}
            className="mt-7 inline-flex min-h-13 items-center gap-2.5 rounded-full border bg-card px-6 py-3.5 text-base font-bold text-foreground transition-transform hover:-translate-y-0.5 sm:px-7"
          >
            Lire le protocole complet
            <ArrowRight className="size-5" />
          </Link>
        </div>

        <div className="reveal">
          <p className="font-heading text-6xl font-extrabold leading-none text-secondary-foreground md:text-7xl">
            3× moins
          </p>
          <p className="mt-4 max-w-[34ch] font-semibold text-muted-foreground">
            d'allergies à un an chez les enfants exposés tôt et régulièrement
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Étude EAT · 1 300 nourrissons suivis
          </p>
        </div>
      </div>
    </TintedSection>
  );
}

/* ---------------------------------------------------------------- vraie vie */

/**
 * Le suivi réel et le rattrapage (docs/feats/suivi-reel-et-rattrapage.md). La
 * section répond à l'objection numéro un du parent, celle qui décide de tout :
 * « je ne tiendrai jamais un programme ». D'où des situations vécues en titre,
 * et le nom des fonctionnalités seulement après.
 */
/*
 * Le bas de cette section porte un appel à l'action, pas du texte : il appelle
 * la section suivante plutôt qu'il ne la repousse. D'où un `pb` réduit ici,
 * quand les autres sections gardent le rythme vertical plein.
 */
function RealLife() {
  const cards = [
    {
      title: "Il n'a rien mangé",
      body: "Un geste, et on n'en parle plus. La découverte manquée revient demain.",
    },
    {
      title: "Il a mangé autre chose",
      body: "Un petit pot, un reste ? Notez ce qu'il a vraiment eu : si c'était une découverte, elle compte.",
    },
    {
      title: "Plus de courgettes en stock",
      body: "Trois remplaçants qu'il connaît déjà vous sont proposés. Recette et liste de courses se mettent à jour.",
    },
    {
      title: "Absents ce week-end",
      body: "Prévenez à l'avance : le programme s'organise sans vous, et reprend au retour.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 pt-16 pb-9 md:px-8 md:pt-20 md:pb-10">
      <Eyebrow>Pensé pour la vraie vie</Eyebrow>
      <SectionTitle>Un repas sauté ne casse rien</SectionTitle>
      <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
        Purée recrachée, repas chez la nounou, courgette oubliée au supermarché
        : signalez-le d'un geste, le programme se réorganise tout seul. Ni
        score, ni série à tenir, ni pastille rouge.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.title}
            className="reveal rounded-lg border bg-card p-7"
          >
            <h3 className="font-heading text-xl font-bold">{card.title}</h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {card.body}
            </p>
          </article>
        ))}
      </div>

      <PrimaryCta className="mt-10">Voir le programme de mon bébé</PrimaryCta>
    </section>
  );
}

/* -------------------------------------------------------------------- vocal */

/**
 * La commande vocale (docs/feats/commande-vocale.md). Elle arrive juste après
 * « la vraie vie », parce qu'elle en est la conclusion : cette section-là ramène
 * la divergence à un geste, celle-ci retire le geste. C'est l'ordre du constat
 * qui a fait naître la fonctionnalité — le problème n'est plus ce que
 * l'application sait faire, c'est ce qu'il en coûte de le lui dire.
 *
 * Les quatre familles et leurs exemples sont repris **mot pour mot** de
 * `voice-examples.tsx`, et l'échange reproduit la carte de confirmation de
 * `voice-intent-block.tsx`, message d'impact compris. La règle des exemples vaut
 * ici aussi, en plus fort : on ne met jamais en exemple une phrase que le
 * moteur ne saurait pas encaisser, sous peine de vendre un pouvoir que la
 * première dictée démentira.
 */
function Voice() {
  const abilities = [
    {
      icon: Utensils,
      label: "Enregistrer un repas",
      example: "Il a mangé des poireaux et de la pomme ce midi",
    },
    {
      icon: Heart,
      label: "Dire comment ça s'est passé",
      example: "Pas de repas ce midi, on était chez la nounou",
    },
    {
      icon: Repeat,
      label: "Modifier le menu",
      example: "Je n'ai plus de courgette, mets du brocoli",
    },
    {
      icon: HelpCircle,
      label: "Poser une question",
      example: "Qu'est-ce qu'il doit manger ce soir ?",
    },
  ];

  return (
    <TintedSection>
      <Eyebrow>Nouveau · commande vocale</Eyebrow>
      <SectionTitle className="max-w-[28ch]">
        Une main sur l'enfant, l'autre sur la casserole
      </SectionTitle>
      <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
        Il vous reste la voix. Dites ce qu'il a mangé, changez le menu, demandez
        ce qu'il doit manger ce soir : une phrase ordinaire, comme vous la
        raconteriez à quelqu'un. L'application affiche ce qu'elle a compris,{" "}
        <strong className="text-foreground">vous validez d'un tap</strong>. Trop
        de bruit dans la cuisine, ou le petit qui dort à côté ? Écrivez-le,
        c'est le même moteur derrière.
      </p>

      <div className="mt-10 grid items-start gap-8 md:grid-cols-2 md:gap-12">
        <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
          {abilities.map((ability) => (
            <li key={ability.label} className="rounded-lg border bg-card p-5">
              <p className="flex items-center gap-2.5 font-heading text-base font-bold">
                <ability.icon className="size-4 shrink-0 text-primary" />
                {ability.label}
              </p>
              <p className="mt-1.5 leading-snug text-muted-foreground">
                « {ability.example} »
              </p>
            </li>
          ))}
        </ul>

        <div className="reveal">
          <VoiceExchange />
        </div>
      </div>
    </TintedSection>
  );
}

/**
 * L'échange complet en deux temps : la phrase dite, puis la carte à valider.
 * C'est la seule façon honnête de montrer la fonctionnalité, parce que la
 * moitié de la promesse tient dans la seconde vignette — le modèle propose, il
 * n'écrit pas, et rien ne part en base sans le tap du parent.
 *
 * Les ondes du micro reprennent `voice-halo` (globals.css), déjà neutralisé
 * sous `prefers-reduced-motion` : une animation en boucle sur une page de vente
 * est exactement le genre de chose qu'on coupe pour qui l'a demandé.
 */
function VoiceExchange() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-3xl border bg-card p-5">
        <span
          aria-hidden
          className="relative grid size-14 shrink-0 place-items-center"
        >
          {/* Les ondes se propagent derrière le bouton, jamais dedans. */}
          <span className="voice-halo absolute inset-0 rounded-full bg-primary" />
          <span className="voice-halo absolute inset-0 rounded-full bg-primary [animation-delay:1450ms]" />
          <span className="relative grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_-10px_var(--primary)]">
            <Mic className="size-6" />
          </span>
        </span>
        <p className="font-heading text-lg font-medium leading-snug text-balance">
          « Il a mangé des poireaux et de la pomme ce midi, il a adoré »
        </p>
      </div>

      <div className="rounded-3xl border bg-card p-6 shadow-lifted">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Déjeuner · aujourd'hui
        </p>

        <div className="mt-3.5 flex flex-wrap gap-2">
          {["Blanc de poireau", "Pomme"].map((food) => (
            <span
              key={food}
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium"
            >
              <Check className="size-3.5 shrink-0 text-primary" />
              {food}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium">
            <span aria-hidden>😋</span> Adoré
          </span>
        </div>

        {/* Ce que le programme va faire, avant que le parent valide. */}
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-novelty/30 bg-novelty-soft px-3.5 py-2.5 text-sm text-foreground/85">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-novelty" />
          <span>
            Blanc de poireau, c'est une première — on le repropose demain.
          </span>
        </p>

        <div className="mt-5 flex items-center gap-3">
          <span className="px-2 text-sm font-semibold text-muted-foreground">
            Annuler
          </span>
          <span className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">
            <Check className="size-4" />
            C'est noté
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ preuves */

/**
 * La preuve de sérieux : c'est ce qui sépare Petite Cuillère d'un menu trouvé
 * sur un forum. Les deux pages liées sont publiques (cf.
 * `src/lib/routes.ts`) — on ne demande pas de créer un compte pour
 * vérifier nos sources.
 *
 * ⚠️ Les trois témoignages ci-dessous sont des exemples de mise en page, pas
 * des retours réels. À remplacer par de vrais avis, avec l'accord des parents,
 * avant l'ouverture publique du site — ou à retirer.
 */
function Proof() {
  const sources = [
    "PNNS 4",
    "ESPGHAN",
    "OMS",
    "Étude LEAP",
    "Étude EAT",
    "Cohorte ELFE",
  ];

  const quotes = [
    {
      quote:
        "Fini les trois onglets ouverts entre deux blogs contradictoires. Je regarde l'app le matin, je cuisine, c'est réglé.",
      author: "Claire · maman d'Anna, 7 mois",
    },
    {
      quote:
        "L'arachide me terrifiait. Le protocole est arrivé au bon moment, à la bonne dose, et on a suivi. Sereinement.",
      author: "Mehdi · papa de Naël, 9 mois",
    },
    {
      quote:
        "La nounou voit le même programme que nous et note les repas. Le soir, on sait exactement où il en est.",
      author: "Julie & Thomas · parents de Marius, 6 mois",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-20">
      <Eyebrow>Sur quoi c'est fondé</Eyebrow>
      <SectionTitle>Les mêmes sources que votre pédiatre</SectionTitle>
      <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
        Chaque repas suit les recommandations officielles. La méthode est
        publique, détaillée principe par principe, chiffres et sources à l'appui
        :{" "}
        <Link
          href={METHODE_URL}
          className="font-bold text-primary underline-offset-4 hover:underline"
        >
          comment le programme est construit
        </Link>{" "}
        et{" "}
        <Link
          href={ALLERGENES_URL}
          className="font-bold text-primary underline-offset-4 hover:underline"
        >
          comment les allergènes sont introduits
        </Link>
        .
      </p>

      <ul className="mt-7 flex flex-wrap gap-2.5">
        {sources.map((source) => (
          <li
            key={source}
            className="rounded-full border bg-card px-4 py-2 text-sm font-bold text-muted-foreground"
          >
            {source}
          </li>
        ))}
      </ul>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {quotes.map((q) => (
          <figure
            key={q.author}
            className="reveal flex flex-col rounded-lg border bg-card p-7"
          >
            <blockquote className="leading-relaxed">« {q.quote} »</blockquote>
            <figcaption className="mt-4 text-sm font-semibold text-muted-foreground">
              {q.author}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- how it works */

function HowItWorks() {
  const steps = [
    {
      title: "Répondez à 3 questions",
      body: "Sa date de naissance, où il en est, ce qu'il a déjà goûté s'il a commencé.",
    },
    {
      title: "Son programme s'affiche",
      body: "Un calendrier complet, adapté à son âge. Le compte ne sert qu'à le garder et le partager.",
    },
    {
      title: "Cuisinez, dites-le, c'est tout",
      body: "Un tap ou une phrase à voix haute : découvertes, courses et suivi des allergènes se mettent à jour tout seuls.",
    },
  ];

  return (
    <TintedSection>
      <Eyebrow>Comment ça marche</Eyebrow>
      <SectionTitle>
        Prêt en moins d'une minute, sans créer de compte
      </SectionTitle>

      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="reveal rounded-lg border bg-card p-7">
            <span
              aria-hidden
              className="blob grid size-9 place-items-center bg-apricot font-heading text-base font-extrabold text-apricot-foreground"
            >
              {i + 1}
            </span>
            <h3 className="mt-4 font-heading text-xl font-bold">
              {step.title}
            </h3>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </TintedSection>
  );
}

/* ---------------------------------------------------------------------- faq */

/**
 * `<details>` natif : l'accordéon fonctionne sans une ligne de JavaScript, et
 * le contenu reste dans le HTML servi — donc lisible par les moteurs de
 * recherche, qui est précisément le public de cette section.
 */
function Faq() {
  const items = [
    {
      question: "On commence à 7 mois : il est en retard ?",
      answer:
        "Non. Ses premières semaines avancent en douceur, puis il rejoint le rythme de son âge en un mois et demi environ. Les textures, les allergènes et le fer, eux, restent calés sur son âge réel : ceux-là ont un vrai rendez-vous à respecter.",
    },
    {
      question: "Pourquoi c'est gratuit ?",
      answer:
        "Petite Cuillère est un projet de parents, né pour leur fils Mathis. Pas de publicité, pas de revente de données, pas de version « premium » cachée. Gratuit, sans limite.",
    },
    {
      question: "Qui peut suivre le programme avec nous ?",
      answer:
        "Le co-parent, les grands-parents, la nounou : chacun voit le même programme et note les repas, avec un simple code reçu par email. Deux enfants à la maison ? Chacun a le sien.",
    },
    {
      question: "Quand je dicte, ma voix part où ?",
      answer:
        "L'enregistrement n'est jamais conservé : il traverse notre transcripteur, une société française qui héberge en Europe, le temps de votre phrase. Et rien ne s'écrit sans vous : l'application affiche ce qu'elle a compris, la phrase reste modifiable, et c'est votre validation qui enregistre.",
    },
    {
      question: "Et le lait dans tout ça ?",
      answer:
        "Il reste la base du repas pendant toute la première année. Le programme affiche les quantités attendues à chaque âge, 500 à 750 mL par jour à six mois par exemple, à côté des repas solides.",
    },
    {
      question: "Frais, surgelé, de saison ?",
      answer:
        "Chaque aliment indique si c'est le bon moment. Fraises en juin, épinards surgelés en février : les deux sont de bonnes réponses. La vue mensuelle vous dit même quoi congeler d'avance, le batch cooking sans le tableur.",
    },
    {
      question: "Et si on fait la DME (morceaux) plutôt que les purées ?",
      answer:
        "Le programme suit l'évolution des textures recommandée par les sociétés savantes, du lisse aux morceaux. Chaque recette précise la texture adaptée à son âge, et vous restez libres d'aller à son rythme.",
    },
  ];

  return (
    <section className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-20">
      <Eyebrow>Questions fréquentes</Eyebrow>
      <SectionTitle>Vous vous demandez sûrement…</SectionTitle>

      <div className="mt-8 space-y-3.5">
        {items.map((item) => (
          <details
            key={item.question}
            className="group rounded-md border bg-card px-6 py-5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-heading text-lg font-bold [&::-webkit-details-marker]:hidden">
              {item.question}
              <Plus
                aria-hidden
                className="size-5 shrink-0 text-primary transition-transform group-open:rotate-45"
              />
            </summary>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------- closing cta */

function ClosingCta() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
      <section className="reveal relative overflow-hidden rounded-3xl bg-pine px-6 py-20 text-center md:rounded-4xl md:px-14">
        <span
          aria-hidden
          className="blob pointer-events-none absolute -right-16 -top-16 size-72 bg-pine-foreground/10 blur-2xl"
        />
        <h2 className="relative mx-auto max-w-[22ch] font-heading text-3xl font-bold text-balance text-pine-foreground md:text-[2.5rem] md:leading-[1.12]">
          Son prochain repas est déjà prêt à être cuisiné
        </h2>
        <p className="relative mx-auto mt-4 max-w-[52ch] text-lg leading-relaxed text-pine-foreground/80">
          Gratuit, sans compte, fondé sur la science. Il ne manque que sa date
          de naissance.
        </p>
        <Link
          href="/decouvrir"
          className="relative mt-9 inline-flex min-h-13 items-center gap-2.5 rounded-full bg-apricot px-6 py-3.5 text-base font-bold text-apricot-foreground shadow-[0_10px_28px_-10px_rgb(0_0_0/0.5)] transition-transform hover:-translate-y-0.5 sm:px-7"
        >
          Créer le programme de mon bébé
          <ArrowRight className="size-5" />
        </Link>
        <p className="relative mt-4 text-sm text-pine-foreground/70">
          Prêt en 1 minute · aucune carte bancaire · aucune publicité
        </p>
      </section>
    </div>
  );
}
