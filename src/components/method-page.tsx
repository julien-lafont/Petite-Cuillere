/**
 * Building blocks for the "How it is built" pages.
 *
 * These pages have one purpose: that a parent leaves knowing their child's
 * programme was not invented. Writing rules, in order:
 *
 *   1. One idea per block, and the "why" always before the "how".
 *   2. No technical term — no "generator", no "threshold", no "category".
 *   3. A verifiable figure rather than a general claim.
 *   4. Never an order, never a judgement on how the parent does things.
 *   5. Sources are named, dated and clickable: that is what separates a method
 *      from an opinion.
 *
 * The layout follows the "morning market" direction (see globals.css): a narrow
 * reading column, rules numbered by an apricot blob, "à retenir" boxes on a
 * spinach background, and large deep-green blocks for cross-links.
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import { NavPending } from "@/components/nav-pending";
import {
  ArrowRight,
  BookOpen,
  ExternalLink,
  Stethoscope,
  ChevronRight,
} from "lucide-react";

/* ---------------------------------------------------------------- page header */

/**
 * Width of the editorial column. It is set by the pages themselves (and by their
 * skeleton) rather than by a layout, because these pages render inside two
 * shells: the public header and the AppShell.
 *
 * 60 rem is exactly the AppShell's usable area at its widest (`max-w-5xl` minus
 * its `md:px-8` margins): the column therefore lines up with the rest of the app
 * instead of floating in the middle of it.
 *
 * This width is the only one: inside it, nothing sets its own measure. A
 * standfirst, a rule paragraph and an "à retenir" box therefore share exactly
 * the same left and right edges as the contents list or the figures grid,
 * instead of each stopping somewhere else — that single alignment is what holds
 * the page together, the column already being narrow enough for line length to
 * stay readable.
 */
export const METHOD_COLUMN = "mx-auto max-w-[60rem]";

/**
 * Switcher between the two halves of the method.
 *
 * It is carried by the content rather than by a shell, because these pages have
 * two shells and neither gave the other half on a phone: the public header tucks
 * its two links away below 768 px (`site-chrome`), and the app's never had them.
 * That left the footer, ten sections further down.
 *
 * The shape is the app's sub-tabs (`SectionTabs`, `app-shell`): the parent has
 * seen it elsewhere already. For the same reason that row hides itself on these
 * routes rather than doubling this one.
 *
 * The current half is not a link: it has nowhere to lead, and a target that does
 * nothing under the thumb is worse than an inert label.
 */
export function MethodSwitch({
  current,
  otherHref,
}: {
  /** The half currently being read. */
  current: "methode" | "allergenes";
  /** The other half: the public one or the app's, depending on the reader. */
  otherHref: string;
}) {
  return (
    <nav
      aria-label="Les deux parties de la méthode"
      className="flex gap-1 rounded-full bg-muted p-1"
    >
      {(["methode", "allergenes"] as const).map((part) => {
        const label = part === "methode" ? "La méthode" : "Allergènes";

        return part === current ? (
          <span
            key={part}
            aria-current="page"
            className="flex-1 rounded-full bg-card px-3 py-2.5 text-center text-sm font-semibold text-foreground shadow-soft"
          >
            {label}
          </span>
        ) : (
          <Link
            key={part}
            href={otherHref}
            className="relative flex-1 rounded-full px-3 py-2.5 text-center text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground has-[[data-pending]]:bg-card has-[[data-pending]]:text-foreground has-[[data-pending]]:shadow-soft"
          >
            {label}
            <NavPending className="absolute top-1/2 right-3 size-1.5 -translate-y-1/2 rounded-full bg-current" />
          </Link>
        );
      })}
    </nav>
  );
}

export function MethodHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  /** The standfirst, passed as children so it can hold emphasis. */
  children: React.ReactNode;
}) {
  return (
    <header className="space-y-5">
      <div>
        <p className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.12em] text-primary uppercase">
          <span aria-hidden className="size-2.5 shrink-0 blob bg-apricot" />
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

/** The header's three headline figures. Never more than three: past that, nothing stands out. */
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
 * Anchored table of contents. The page is long and rarely read in one go: the
 * parent often comes looking for one specific rule, the one they heard about.
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
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-secondary-foreground sm:columns-2 sm:space-y-0 sm:gap-x-8">
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

/* -------------------------------------------------------------------- rules */

/**
 * One rule of the programme: its number in an apricot blob, its title, its
 * elaboration. `scroll-mt` compensates for the sticky header, without which a
 * contents anchor would land under the navigation bar.
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
       * Top-aligned while the title wraps onto several lines (mobile), centred
       * after that: centring a number against a three-line title leaves it
       * floating in the middle of nowhere.
       */}
      <div className="flex items-start gap-4 md:items-center">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center blob bg-apricot font-heading text-lg font-extrabold text-apricot-foreground"
        >
          {step}
        </span>
        <h2 className="font-heading text-[1.4rem] leading-[1.2] font-bold text-balance md:text-[1.9rem]">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-3.5 text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground [&>p]:leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/**
 * The "à retenir" box: what the parent should keep if they remember one sentence
 * of the rule. Set apart from the running text, with a green rule on the left,
 * so it is spotted while skimming the page.
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
 * An ordered sequence of chips separated by chevrons: the order of the first
 * seven vegetables, the opening of meals. The arrow carries the sense of "then",
 * so it is decorative to a screen reader — the ordered list is what conveys the
 * information.
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
           * The chevron follows its chip rather than preceding the next one: when
           * the sequence wraps, it stays at the end of the previous line instead
           * of opening the new one with an orphan arrow.
           */}
          {i < items.length - 1 && (
            <ChevronRight aria-hidden className="size-4 shrink-0 text-border" />
          )}
        </li>
      ))}
    </ol>
  );
}

/** The figure a rule rests on, lifted out of the text so it is seen without reading. */
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

/** Three stages of a protocol, each summarised in two words under an icon. */
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
 * The cases where the programme does not decide alone. The apricot rule on the
 * left sets them apart from the green "à retenir" boxes: here you are not
 * remembering an instruction, you are recognising a situation where we hand over.
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
 * The medical reminder. Deliberately undramatic: it should read as an honest
 * limit of the product, not as a legal warning to skim past.
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
        <span aria-hidden className="size-2.5 shrink-0 blob bg-apricot" />
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
 * Link to the other method page. A solid block and not a discreet link: the two
 * pages form a whole, and reaching the end of one without knowing the other
 * exists would be a missed opportunity.
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

/** End-of-page call to action, twin of the landing's. */
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
        Prêt en une minute !
      </p>
    </section>
  );
}

/**
 * Entry point to a method page, from the app screen it explains. Placed high
 * rather than in the footer: the question "where does all this come from?" comes
 * up while discovering the screen, not after going through it.
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
      <span className="flex size-9 shrink-0 items-center justify-center blob bg-apricot text-apricot-foreground">
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
