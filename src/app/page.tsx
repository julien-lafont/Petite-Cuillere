import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Mic,
  Plus,
} from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";
import { cn } from "@/lib/utils";

const TITLE = "Petite Cuillère — Le repas de bébé, chaque jour, sans y penser";
const DESCRIPTION =
  "Le programme de diversification de votre bébé, jour par jour, de 4 à 12 mois : quoi cuisiner, quantité, texture, allergènes compris. Gratuit, sans compte, fondé sur les recommandations officielles.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // The canonical is set here rather than in the root layout: putting "/" there
  // would mark the landing as the canonical of every page on the site.
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: TITLE, description: DESCRIPTION },
  twitter: { title: TITLE, description: DESCRIPTION },
};

/**
 * Public landing. Direction "the morning market" (see globals.css): milk
 * background, spinach blocks, apricot blobs, headings in tight display. The
 * sections show the real product — the day's card, the discovery calendar —
 * rather than abstract visuals.
 *
 * WRITING RULES, to hold on every edit:
 *
 *   1. We speak to a tired parent, not a health professional. Benefit first,
 *      mechanism only when it reassures.
 *   2. A concrete situation beats a named feature ("il était chez sa grand-mère"
 *      rather than "gestion des absences").
 *   3. No cascading em dashes: a colon, a comma or a full stop.
 *   4. Never an order nor guilt, including implicitly.
 *
 * The CTAs point at `/decouvrir`: the programme can be seen without an account
 * (see §3.5), and that is the page's strongest argument. The credibility proof
 * comes right after, with the two method pages, also public
 * (`src/lib/routes.ts`).
 *
 * The content reproduced here is frozen by hand. When the copy in
 * `lib/program/stage.ts` (stages, changes), `lib/program/diff.ts` (catch-up
 * sentences), `components/voice-examples.tsx` (the dictation examples),
 * `components/voice-intent-block.tsx` (the confirmation card) or the allergen
 * catalogue changes, remember to realign the matching cards so the promise stays
 * true to the product.
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
        <Voice />
        <Proof />
        <Allergens />
        <RealLife />
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
 * Bootstraps the scroll reveals. Written as inline JavaScript rather than a
 * client component: the page is entirely static, and loading a React bundle to
 * watch intersections would be out of proportion.
 *
 * Two things matter:
 *
 *   1. The `js-reveal` class is set **synchronously**, before the browser paints
 *      the rest of the document — which is why the script is rendered at the very
 *      top of the body. A `useEffect` would arrive after the first render and
 *      flash the blocks already in view.
 *   2. The observer unsubscribes as soon as a block has appeared: the animation
 *      does not replay on the way back up, and a page that twitches on every
 *      scroll gets tiresome fast.
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

/** Section eyebrow: a small apricot blob, then the label in caps. */
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

/** Main CTA. The note always goes with it: free, and no account needed. */
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
 * A tinted section block: the large spinach rectangle with very round corners
 * that paces the page. It lives in the gutter, hence the double wrapper.
 */
function TintedSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-5 md:px-8">
      <section className="rounded-3xl bg-secondary px-6 py-12 md:rounded-4xl md:px-14 md:py-16">
        {children}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------- hero */

function Hero() {
  const proofs = [
    { label: "Prêt en moins d'une minute" },
    /*
     * The only one of the three a parent might want to check — so it leads to
     * the method. On a phone it is even the first link to it: the header tucks
     * its own away below 768 px (see `site-chrome`), and the page only mentions
     * it again in the "Sur quoi c'est fondé" section, six screens down.
     */
    { label: "Respecte les recommandations officielles", href: METHODE_URL },
    { label: "Se pilote à la voix" },
  ];

  // The three chips keep the same height, that of a comfortable target: only one
  // is clickable, but a row with uneven heights reads as a layout mistake.
  const proofClass =
    "flex min-h-11 items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm font-semibold";

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-10 pt-16 md:px-8 md:pb-12 md:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:gap-14">
      <div>
        <Eyebrow>Diversification · de 4 à 12 mois · gratuit</Eyebrow>
        {/*
         * `isolate` is essential: the title's highlight sits behind the text
         * (negative z-index), so it needs a local stacking context or it
         * disappears under the page background.
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

        <ul className="mt-9 flex flex-col gap-2">
          {proofs.map((proof) => (
            <li key={proof.label}>
              {proof.href ? (
                <Link
                  href={proof.href}
                  className={cn(
                    proofClass,
                    "border-primary/35 text-foreground transition-colors hover:border-primary/60 hover:bg-secondary/50",
                  )}
                >
                  <Check className="size-4 shrink-0 text-primary" />
                  <span className="flex-1">{proof.label}</span>
                  <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                </Link>
              ) : (
                <span className={cn(proofClass, "text-muted-foreground")}>
                  <Check className="size-4 shrink-0 text-primary" />
                  {proof.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="reveal relative mx-auto w-full max-w-[25rem] lg:ml-auto lg:mr-0">
        {/* Decorative blob slipped behind the corner of the card. */}
        <span
          aria-hidden
          className="blob absolute -left-4 -top-4 -z-10 size-20 bg-secondary"
        />
        <TodayCard />
      </div>
    </section>
  );
}

/** A faithful reproduction of the "Aujourd'hui" card, as proof of the product. */
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
        <span aria-hidden>💡</span> Revient 5 fois ce mois-ci : congelez 4
        portions d'avance.
      </p>

      {/* The evening gesture: rate the meal in one tap. */}
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

/* ------------------------------------------------------ discovery frieze */

/**
 * The page's visual signature: the discovery calendar reduced to eight stops.
 * The badge colours are fruit hues picked one by one, deliberately outside the
 * design tokens — it is an illustration, not an interface component, and it must
 * look the same in both themes. The emoji is decorative: the food's name is
 * written below it.
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
        {/* The rail: hidden on mobile, where the stops wrap onto two rows. */}
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

/* ------------------------------------------------------------- allergens */

/**
 * The most anxiety-inducing subject in diversification, and the one where the
 * product goes furthest. We hold two ideas, no more: introducing early protects,
 * and maintenance matters as much as the first spoonful. All the detail (doses,
 * windows, contraindications) lives on the allergens page — a landing is not the
 * place for clinical material.
 *
 * The "sixteen" comes from the catalogue (`supabase/reset.sql`, read by
 * `lib/program/allergens.ts`): realign it if the catalogue changes.
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
            <strong className="text-foreground">revient régulièrement</strong> :
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
 * Real tracking and catch-up (docs/feats/suivi-reel-et-rattrapage.md). This
 * section answers the parent's number one objection, the one that decides
 * everything: "I'll never keep to a programme". Hence lived situations as
 * headings, and the feature names only afterwards.
 */
/*
 * The bottom of this section carries a call to action, not text: it pulls the
 * next section in rather than pushing it away. Hence a reduced `pb` here, where
 * the other sections keep the full vertical rhythm.
 */
function RealLife() {
  const cards = [
    {
      title: "Il n'a rien mangé",
      body: "Un geste, et on n'en parle plus. La découverte manquée revient demain.",
    },
    {
      title: "Il a mangé autre chose",
      body: "Un petit pot, un reste ? Notez ce qu'il a vraiment eu : si c'était une découverte, elle compte.",
    },
    {
      title: "Plus de courgettes en stock",
      body: "Trois remplaçants qu'il connaît déjà vous sont proposés. Recette et liste de courses se mettent à jour.",
    },
    {
      title: "Absents ce week-end",
      body: "Prévenez à l'avance : le programme s'organise sans vous, et reprend au retour.",
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 pt-16 pb-9 md:px-8 md:pt-20 md:pb-10">
      <Eyebrow>Pensé pour la vraie vie</Eyebrow>
      <SectionTitle>Un repas sauté ne casse rien</SectionTitle>
      <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
        Purée recrachée, repas chez la nounou, courgette oubliée au supermarché
        {" : "}
        signalez-le d'un geste, le programme se réorganise tout seul. Ni score,
        ni série à tenir, ni pastille rouge.
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
 * Voice commands (docs/feats/commande-vocale.md). It comes right after "real
 * life", because it is that section's conclusion: the previous one reduces the
 * divergence to a gesture, this one removes the gesture. That is the order of
 * the observation that created the feature — the problem is no longer what the
 * app can do, it is what it costs to tell it.
 *
 * The heading is the launcher's (`voice-examples.tsx` shows it at the top of
 * "Aujourd'hui"): the promise read on the landing is word for word the one found
 * in the app. Same rule for the example sentences, taken as is from the
 * launcher: we never showcase a sentence the engine could not handle, or we sell
 * a power the first dictation will disprove.
 *
 * Each column has its own caption, because they do not show the same thing: on
 * the left the breadth (what you can say), on the right the depth (what happens
 * when you say it). Without captions the left-hand cards read as the start of a
 * conversation and the right-hand card as its continuation.
 */
function Voice() {
  const phrases = [
    {
      kicker: "Enregistrer un repas",
      phrase: "Ce matin, il a eu une compote de poire",
    },
    {
      kicker: "Dire comment ça s'est passé",
      phrase: "Pas de repas ce midi, on était chez la nounou",
    },
    {
      kicker: "Modifier le menu",
      phrase: "Je n'ai plus de courgette, mets du brocoli",
    },
    {
      kicker: "Poser une question",
      phrase: "Est-ce que je peux lui donner du miel ?",
    },
  ];

  return (
    <TintedSection>
      <Eyebrow>Commande vocale · sans les mains</Eyebrow>
      <SectionTitle>Dites-le, c'est enregistré!</SectionTitle>
      <p className="mt-5 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
        Bébé au bras, la purée sur le feu : ce n'est pas le moment de pianoter
        sur un écran. Alors dites-le, comme vous le raconteriez à l'autre
        parent. Une phrase suffit : le repas s'enregistre, le menu se corrige,
        la question trouve sa réponse.
      </p>

      <div className="mt-10 grid items-start gap-10 md:grid-cols-2 md:gap-12">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-secondary-foreground/75">
            Ce que vous pouvez dire
          </h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            {phrases.map((item) => (
              <li key={item.kicker} className="rounded-lg border bg-card p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
                  {item.kicker}
                </p>
                <p className="mt-2 font-heading text-lg font-bold leading-snug">
                  « {item.phrase} »
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="reveal">
          <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-secondary-foreground/75">
            Ce qui se passe ensuite
          </h3>
          <div className="mt-4">
            <VoiceExchange />
          </div>
        </div>
      </div>
    </TintedSection>
  );
}

/**
 * The full exchange, presented as a two-voice conversation: the sentence said,
 * then the app's proposal. The "Vous" and "Petite Cuillère" labels are not
 * decorative — without them the lower card read as an orphan screenshot rather
 * than as a reply.
 *
 * Half the promise lives in that second card: the model proposes, it does not
 * write, and nothing reaches the database without the parent's tap. The caption
 * under the card says so, exactly where it is read.
 *
 * The mic's waves reuse `voice-halo` (globals.css), already neutralised under
 * `prefers-reduced-motion`: a looping animation on a sales page is exactly the
 * kind of thing you switch off for anyone who asked.
 */
function VoiceExchange() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-secondary-foreground/60">
          Vous
        </p>
        <div className="mt-2 flex items-center gap-4 rounded-3xl border bg-card p-5">
          <span
            aria-hidden
            className="relative grid size-14 shrink-0 place-items-center"
          >
            {/* The waves spread behind the button, never inside it. */}
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
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-secondary-foreground/60">
          Petite Cuillère
        </p>
        <div className="mt-2 rounded-3xl border bg-card p-6 shadow-lifted">
          <p className="text-sm font-semibold">
            Pour le déjeuner d'aujourd'hui :
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
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

          {/* What the programme will do, before the parent confirms. */}
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
              Confirmer
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ preuves */

/**
 * The credibility proof: it is what separates Petite Cuillère from a menu found
 * on a forum. Both linked pages are public (see `src/lib/routes.ts`) — we do not
 * ask anyone to create an account to check our sources.
 *
 * ⚠️ The three testimonials below are layout placeholders, not real feedback.
 * Replace them with genuine reviews, with the parents' consent, before the site
 * opens publicly — or remove them.
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
        {" : "}
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
      body: "Un tap ou une phrase à voix haute : découvertes, courses et suivi des allergènes se mettent à jour tout seuls.",
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
 * Native `<details>`: the accordion works without a line of JavaScript, and the
 * content stays in the served HTML — so readable by search engines, which are
 * precisely this section's audience.
 */
function Faq() {
  const items = [
    {
      question: "On commence à 7 mois : il est en retard ?",
      answer:
        "Non. Ses premières semaines avancent en douceur, puis il rejoint le rythme de son âge en un mois et demi environ. Les textures, les allergènes et le fer, eux, restent calés sur son âge réel : ceux-là ont un vrai rendez-vous à respecter.",
    },
    {
      question: "Pourquoi c'est gratuit ?",
      answer:
        "Petite Cuillère est un projet de parents, né pour leur fils Mathis. Pas de publicité, pas de revente de données, pas de version « premium » cachée. Gratuit, sans limite.",
    },
    {
      question: "Qui peut suivre le programme avec nous ?",
      answer:
        "Le co-parent, les grands-parents, la nounou : chacun voit le même programme et note les repas, avec un simple code reçu par email. Deux enfants à la maison ? Chacun a le sien.",
    },
    {
      question: "Quand je dicte, ma voix part où ?",
      answer:
        "L'enregistrement n'est jamais conservé : il traverse notre transcripteur, une société française qui héberge en Europe, le temps de votre phrase. Et rien ne s'écrit sans vous : l'application affiche ce qu'elle a compris, la phrase reste modifiable, et c'est votre validation qui enregistre.",
    },
    {
      question: "Et le lait dans tout ça ?",
      answer:
        "Il reste la base du repas pendant toute la première année. Le programme affiche les quantités attendues à chaque âge, 500 à 750 mL par jour à six mois par exemple, à côté des repas solides.",
    },
    {
      question: "Frais, surgelé, de saison ?",
      answer:
        "Chaque aliment indique si c'est le bon moment. Fraises en juin, épinards surgelés en février : les deux sont de bonnes réponses. La vue mensuelle vous dit même quoi congeler d'avance, le batch cooking sans le tableur.",
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
