/**
 * Briques des pages « Comment c'est construit ».
 *
 * Ces pages ont un seul but : qu'un parent reparte en sachant que le programme
 * de son enfant n'a pas été inventé. Règles d'écriture, dans l'ordre :
 *
 *   1. Une idée par bloc, et le « pourquoi » toujours avant le « comment ».
 *   2. Aucun terme technique — ni « générateur », ni « seuil », ni « catégorie ».
 *   3. Un chiffre vérifiable plutôt qu'une affirmation générale.
 *   4. Jamais d'injonction, jamais de jugement sur la façon de faire du parent.
 *   5. Les sources sont nommées, datées et cliquables : c'est ce qui distingue
 *      une méthode d'un avis.
 *
 * La mise en page suit la direction « le marché du matin » (cf. globals.css) :
 * colonne de lecture étroite, règles numérotées par une tache abricot, encadrés
 * « à retenir » sur fond épinard, et grands blocs vert profond pour les renvois.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  Stethoscope,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------ en-tête de page */

/**
 * Largeur de la colonne éditoriale. Elle est posée par les pages elles-mêmes
 * (et par leur squelette) plutôt que par un layout, parce que ces pages
 * s'affichent dans deux coquilles : l'en-tête public et l'AppShell.
 *
 * 60 rem, c'est exactement la zone utile de l'AppShell au plus large
 * (`max-w-5xl` moins ses marges `md:px-8`) : la colonne s'aligne donc sur le
 * reste de l'app au lieu de flotter en son milieu.
 *
 * Cette largeur est la seule : à l'intérieur, rien ne pose sa propre mesure de
 * ligne. Un chapô, un paragraphe de règle et un encadré « à retenir » partagent
 * donc exactement le même bord gauche et le même bord droit que le sommaire ou
 * la grille de repères, au lieu de s'arrêter chacun ailleurs — c'est cet
 * alignement unique qui tient la page, la colonne étant déjà assez étroite pour
 * que la longueur de ligne reste lisible.
 */
export const METHOD_COLUMN = "mx-auto max-w-[60rem]";

export type Crumb = { label: string; href?: string };

/**
 * Fil d'Ariane. Ces pages se lisent aussi bien depuis la landing que depuis un
 * résultat de recherche : il faut pouvoir situer la page sans avoir vu le reste
 * du site.
 */
function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {trail.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight aria-hidden className="size-3.5 text-border" />
            )}
            {c.href ? (
              <Link
                href={c.href}
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                {c.label}
              </Link>
            ) : (
              <span aria-current="page">{c.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function MethodHeader({
  trail,
  eyebrow,
  title,
  children,
}: {
  trail: Crumb[];
  eyebrow: string;
  title: string;
  /** Le chapô, passé en enfants pour qu'il puisse contenir de l'emphase. */
  children: React.ReactNode;
}) {
  return (
    <header className="space-y-5">
      <Breadcrumb trail={trail} />
      <div>
        <p className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.12em] text-primary uppercase">
          <span aria-hidden className="blob size-2.5 shrink-0 bg-apricot" />
          {eyebrow}
        </p>
        <h1 className="mt-3.5 max-w-[22ch] font-heading text-[2rem] leading-[1.08] font-extrabold text-balance md:text-[3rem]">
          {title}
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
          {children}
        </p>
      </div>
    </header>
  );
}

/** Les trois repères chiffrés de l'en-tête. Jamais plus de trois : au-delà, plus rien ne ressort. */
export function MethodFacts({
  facts,
}: {
  facts: { value: string; label: string }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {facts.map((f) => (
        <div
          key={f.label}
          className="flex flex-col justify-center rounded-lg border bg-card px-5 py-5 text-center"
        >
          <p className="font-heading text-2xl font-extrabold text-balance text-secondary-foreground">
            {f.value}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            {f.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Sommaire ancré. La page est longue et se lit rarement d'un trait : le parent
 * vient souvent chercher une règle précise, celle dont il a entendu parler.
 */
export function MethodToc({
  title,
  items,
}: {
  title: string;
  items: { href: string; label: string }[];
}) {
  return (
    <nav
      aria-label={title}
      className="rounded-lg bg-secondary px-6 py-6 sm:px-7"
    >
      <p className="font-heading text-[0.95rem] font-bold">{title}</p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-secondary-foreground sm:columns-2 sm:gap-x-8 sm:space-y-0">
        {items.map((item) => (
          <li key={item.href} className="text-[0.95rem] sm:mb-1.5">
            <a
              href={item.href}
              className="font-semibold text-secondary-foreground underline-offset-4 hover:underline"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------- règles */

/**
 * Une règle du programme : son numéro en tache abricot, son titre, son
 * développement. `scroll-mt` compense l'en-tête collant, sans quoi une ancre du
 * sommaire ferait atterrir sous la barre de navigation.
 */
export function MethodRule({
  id,
  step,
  title,
  children,
}: {
  id: string;
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 pt-14 first:pt-0">
      {/*
       * Aligné en haut tant que le titre se casse en plusieurs lignes (mobile),
       * centré ensuite : centrer un numéro sur un titre de trois lignes le
       * laisse flotter au milieu de nulle part.
       */}
      <div className="flex items-start gap-4 md:items-center">
        <span
          aria-hidden
          className="blob flex size-11 shrink-0 items-center justify-center bg-apricot font-heading text-lg font-extrabold text-apricot-foreground"
        >
          {step}
        </span>
        <h2 className="font-heading text-[1.4rem] leading-[1.2] font-bold text-balance md:text-[1.9rem]">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-3.5 text-muted-foreground [&>p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

/**
 * L'encadré « à retenir » : ce que le parent doit garder s'il ne retient qu'une
 * phrase de la règle. Mis à part du texte courant, avec un filet vert à gauche,
 * pour qu'on le repère en survolant la page.
 */
export function MethodTakeaway({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border-l-4 border-primary bg-secondary px-5 py-3.5">
      <p className="font-heading text-[0.8rem] font-bold tracking-[0.08em] text-secondary-foreground uppercase">
        À retenir
      </p>
      <p className="mt-1 font-medium text-foreground [&_strong]:font-semibold">
        {children}
      </p>
    </div>
  );
}

/**
 * Suite ordonnée de pastilles, séparées par des chevrons : l'ordre des sept
 * premiers légumes, l'ouverture des repas. La flèche porte le sens « puis »,
 * elle est donc décorative pour un lecteur d'écran — c'est la liste ordonnée
 * qui transmet l'information.
 */
export function MethodChips({
  label,
  items,
}: {
  label: string;
  items: { text: string; detail?: string }[];
}) {
  return (
    <ol
      aria-label={label}
      className="flex list-none flex-wrap items-center gap-2.5"
    >
      {items.map((item, i) => (
        <li key={item.text} className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-semibold">
            {item.text}
            {item.detail && (
              <span className="text-[0.8em] font-semibold text-muted-foreground">
                {item.detail}
              </span>
            )}
          </span>
          {/*
           * Le chevron suit sa pastille au lieu de précéder la suivante : quand
           * la suite passe à la ligne, il reste en fin de ligne précédente
           * plutôt que d'ouvrir la nouvelle par une flèche orpheline.
           */}
          {i < items.length - 1 && (
            <ChevronRight aria-hidden className="size-4 shrink-0 text-border" />
          )}
        </li>
      ))}
    </ol>
  );
}

/** Le chiffre qui fonde une règle, sorti du texte pour qu'on le voie sans lire. */
export function MethodProof({
  value,
  children,
  source,
}: {
  value: string;
  children: React.ReactNode;
  source: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-7 gap-y-4 rounded-lg border bg-card px-7 py-6 shadow-soft">
      <p className="font-heading text-[2.6rem] leading-none font-extrabold text-secondary-foreground">
        {value}
      </p>
      <div className="min-w-[16rem] flex-1">
        <p className="font-medium text-foreground [&_strong]:font-semibold">
          {children}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">{source}</p>
      </div>
    </div>
  );
}

/** Trois temps d'un protocole, chacun résumé en deux mots sous une icône. */
export function MethodProtocol({
  steps,
}: {
  steps: { icon: string; title: string; detail: string }[];
}) {
  return (
    <ol className="grid gap-3.5 sm:grid-cols-3">
      {steps.map((s) => (
        <li
          key={s.title}
          className="rounded-lg border bg-card px-4 py-5 text-center"
        >
          <span aria-hidden className="text-2xl">
            {s.icon}
          </span>
          <p className="mt-1.5 font-heading font-bold">{s.title}</p>
          <p className="text-sm font-semibold text-muted-foreground">
            {s.detail}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * Les cas où le programme ne décide pas seul. Le filet abricot à gauche les
 * distingue des encadrés verts « à retenir » : ici on ne retient pas une
 * consigne, on identifie une situation où l'on passe la main.
 */
export function MethodHandoff({
  cases,
}: {
  cases: { title: string; body: React.ReactNode }[];
}) {
  return (
    <ul className="grid gap-3.5">
      {cases.map((c) => (
        <li
          key={c.title}
          className="rounded-md border border-l-4 border-l-apricot bg-card px-5 py-4"
        >
          <p className="font-heading font-bold text-foreground">{c.title}</p>
          <p className="mt-1 text-[0.95rem] text-muted-foreground">{c.body}</p>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------- blocs de bas de page */

/**
 * Le rappel médical. Volontairement sans dramatisation : il doit être lu comme
 * une limite honnête du produit, pas comme un avertissement juridique qu'on
 * survole.
 */
export function MethodMedical({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-apricot/60 bg-novelty-soft px-6 py-6 sm:px-7">
      <p className="flex items-center gap-2.5 font-heading font-bold text-accent-foreground">
        <Stethoscope aria-hidden className="size-4 shrink-0" />
        {title}
      </p>
      <p className="mt-2 text-[0.97rem] leading-relaxed text-foreground/80 [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </p>
    </section>
  );
}

export type Source = { label: string; detail: string; href: string };

export function MethodSources({
  sources,
  intro,
}: {
  sources: Source[];
  intro: string;
}) {
  return (
    <section className="pt-14">
      <p className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.12em] text-primary uppercase">
        <span aria-hidden className="blob size-2.5 shrink-0 bg-apricot" />
        Transparence
      </p>
      <h2 className="mt-3.5 font-heading text-[1.4rem] font-bold md:text-[1.9rem]">
        D'où viennent ces repères
      </h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">{intro}</p>

      <ul className="mt-6 space-y-3">
        {sources.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-md border bg-card px-5 py-4 transition-colors hover:border-primary"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-heading font-bold">{s.label}</span>
                <span className="mt-0.5 block text-[0.9rem] text-muted-foreground">
                  {s.detail}
                </span>
              </span>
              <ExternalLink
                aria-hidden
                className="mt-1 size-4 shrink-0 text-primary"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Renvoi vers l'autre page de méthode. C'est un bloc plein et non un lien
 * discret : les deux pages forment un tout, et arriver au bout de l'une sans
 * savoir que l'autre existe serait une occasion manquée.
 */
export function MethodBigLink({
  href,
  title,
  description,
  cta,
  className,
}: {
  href: string;
  title: string;
  description: string;
  cta: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group block rounded-lg bg-pine px-7 py-7 text-pine-foreground transition-transform hover:-translate-y-0.5",
        className,
      )}
    >
      <span className="block font-heading text-xl font-bold">{title}</span>
      <span className="mt-1.5 block text-[0.95rem] text-pine-foreground/80">
        {description}
      </span>
      <span className="mt-3 inline-flex items-center gap-2 font-bold text-apricot">
        {cta}
        <ArrowRight
          aria-hidden
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
      </span>
    </Link>
  );
}

/** Appel à l'action de fin de page, jumeau de celui de la landing. */
export function MethodFinalCta({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-3xl bg-pine px-6 py-16 text-center md:rounded-4xl md:px-10">
      <h2 className="mx-auto max-w-[24ch] font-heading text-2xl leading-[1.2] font-bold text-balance text-pine-foreground md:text-[1.9rem]">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-[52ch] leading-relaxed text-pine-foreground/80">
        {description}
      </p>
      <Link
        href="/decouvrir"
        className="mt-7 inline-flex min-h-13 items-center gap-2.5 rounded-full bg-apricot px-6 py-3.5 text-base font-bold text-apricot-foreground shadow-[0_10px_28px_-10px_rgb(0_0_0/0.5)] transition-transform hover:-translate-y-0.5 sm:px-7"
      >
        Créer le programme de mon bébé
        <ArrowRight aria-hidden className="size-5" />
      </Link>
      <p className="mt-4 text-sm text-pine-foreground/70">
        Prêt en une minute, sans carte bancaire
      </p>
    </section>
  );
}

/**
 * Entrée vers une page de méthode, depuis l'écran de l'app qu'elle explique.
 * Placée haut plutôt qu'en pied de page : la question « d'où sort tout ça ? »
 * se pose en découvrant l'écran, pas après l'avoir parcouru.
 */
export function MethodEntryLink({
  href,
  label,
  description,
  className,
}: {
  href: string;
  label: string;
  description: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-lg border border-transparent bg-secondary px-4 py-3.5 transition-colors hover:border-primary/40",
        className,
      )}
    >
      <span className="blob flex size-9 shrink-0 items-center justify-center bg-apricot text-apricot-foreground">
        <BookOpen className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{label}</span>
        <span className="block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
