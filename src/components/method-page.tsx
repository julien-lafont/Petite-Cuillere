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
 */
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ExternalLink,
  Stethoscope,
} from "lucide-react";

export function MethodHeader({
  eyebrow,
  title,
  intro,
  backHref,
  backLabel,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <header className="space-y-4">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <div>
        <p className="text-sm font-medium text-primary">{eyebrow}</p>
        <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-foreground/85">{intro}</p>
      </div>
    </header>
  );
}

/** Un principe : son titre, son explication, et le fait qui le fonde. */
export function MethodSection({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex gap-4">
      <span
        aria-hidden
        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-heading text-sm font-semibold text-secondary-foreground"
      >
        {step}
      </span>
      <div className="min-w-0 flex-1 space-y-2 pb-2">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div className="space-y-3 text-foreground/85">{children}</div>
      </div>
    </section>
  );
}

/**
 * L'encadré qui porte le fait vérifiable — étude, recommandation, chiffre. Mis
 * à part du texte courant pour qu'on voie d'un coup d'œil ce qui est sourcé.
 */
export function MethodEvidence({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border-l-2 border-primary/40 bg-secondary/40 px-4 py-3 text-[0.95em]">
      {children}
    </p>
  );
}

/** Repère chiffré affiché en grand — un seul par page, sinon plus rien ne ressort. */
export function MethodFigure({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-card p-4 text-center shadow-soft">
      <p className="font-heading text-2xl font-semibold text-primary">
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export type Source = { label: string; detail: string; href: string };

export function MethodSources({ sources }: { sources: Source[] }) {
  return (
    <section className="space-y-3 border-t pt-6">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        D'où viennent ces repères
      </h2>
      <ul className="space-y-2">
        {sources.map((s) => (
          <li key={s.href}>
            <a
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-2 text-sm"
            >
              <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground" />
              <span>
                <span className="font-medium underline-offset-2 group-hover:underline">
                  {s.label}
                </span>
                <span className="text-muted-foreground"> — {s.detail}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Le rappel médical. Volontairement en fin de page et sans dramatisation : il
 * doit être lu comme une limite honnête du produit, pas comme un avertissement
 * juridique qu'on survole.
 */
export function MethodDisclaimer({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex gap-3 rounded-lg border border-novelty/25 bg-novelty-soft px-4 py-3.5">
      <Stethoscope className="mt-0.5 size-4 shrink-0 text-novelty" />
      <p className="text-sm text-foreground/85">{children}</p>
    </section>
  );
}

/** Renvoi croisé entre les deux pages de méthode. */
export function MethodCrossLink({
  href,
  label,
  description,
}: {
  href: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3.5 transition-colors hover:border-primary/40"
    >
      <span>
        <span className="block font-heading font-semibold">{label}</span>
        <span className="mt-0.5 block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowLeft className="size-4 shrink-0 rotate-180 text-muted-foreground" />
    </Link>
  );
}

/**
 * Entrée vers une page de méthode, depuis l'écran qu'elle explique. Placée haut
 * plutôt qu'en pied de page : la question « d'où sort tout ça ? » se pose en
 * découvrant l'écran, pas après l'avoir parcouru.
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
        "flex items-center gap-3 rounded-lg border border-primary/15 bg-secondary/45 px-4 py-3 transition-colors hover:border-primary/40",
        className,
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-soft">
        <BookOpen className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block text-sm text-muted-foreground">
          {description}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
