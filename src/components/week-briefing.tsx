import Link from "next/link";
import {
  ArrowRight,
  Clock,
  CookingPot,
  Droplets,
  HeartHandshake,
  Lightbulb,
  Salad,
  Scale,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { WeekBriefing, WeekChangeKind } from "@/lib/program/stage";
import { BookOpen } from "lucide-react";

const CHANGE_ICON: Record<WeekChangeKind, React.ElementType> = {
  moment: Clock,
  category: Salad,
  fat: Droplets,
  texture: CookingPot,
  portion: Scale,
  allergen: ShieldAlert,
  reprise: HeartHandshake,
};

function discoveryLine(briefing: WeekBriefing): string | null {
  const names = briefing.discoveries.map((d) => d.name.toLowerCase());
  if (names.length === 0) return null;
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
  return `${names.length} découverte${names.length > 1 ? "s" : ""} cette semaine : ${list}.`;
}

/**
 * Bandeau d'explication du programme : à quel stade en est l'enfant au dimanche
 * de la semaine affichée, et ce qui change par rapport à la semaine précédente.
 * Quand rien ne change, un conseil prend la place de la liste — sur un ton de
 * couleur distinct pour qu'on voie tout de suite que le registre est différent.
 */
export function WeekBriefingCard({ briefing }: { briefing: WeekBriefing }) {
  const discoveries = discoveryLine(briefing);

  return (
    <section className="rounded-xl border border-primary/15 bg-secondary/45 p-5 shadow-soft">
      <p className="text-sm font-medium text-secondary-foreground">
        Cette semaine · {briefing.ageLabel}
      </p>
      <h2 className="mt-0.5 font-heading text-xl font-semibold tracking-tight">
        {briefing.stageTitle}
      </h2>
      <p className="mt-1.5 max-w-2xl text-foreground/85">
        {briefing.stageSummary}
      </p>

      {briefing.changes.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-primary/15 pt-4">
          {briefing.changes.map((change, i) => {
            const Icon = CHANGE_ICON[change.kind];
            return (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-soft">
                  <Icon className="size-4" />
                </span>
                <p className="text-sm">
                  <span className="font-semibold">{change.title}.</span>{" "}
                  <span className="text-muted-foreground">{change.detail}</span>
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {briefing.tip && (
        <div className="mt-4 flex gap-3 rounded-lg border border-novelty/25 bg-novelty-soft px-4 py-3.5">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-novelty" />
          <div>
            <p className="text-sm font-semibold text-accent-foreground">
              {briefing.tip.title}
            </p>
            <p className="mt-1 text-sm text-foreground/85">
              {briefing.tip.body}
            </p>
          </div>
        </div>
      )}

      {discoveries && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 shrink-0 text-primary" />
          <span className="first-letter:capitalize">{discoveries}</span>
        </p>
      )}

      {/* Le bandeau dit ce qui change cette semaine ; ce lien dit pourquoi.
          C'est ici que la question se pose, au moment de lire le programme. */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-primary/15 pt-4 text-sm">
        <Link
          href="/methode"
          className="inline-flex items-center gap-1.5 font-medium text-secondary-foreground underline-offset-2 hover:underline"
        >
          <BookOpen className="size-4 shrink-0 text-primary" />
          Comment ce programme est construit
        </Link>
        <Link
          href="/methode/allergenes"
          className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Et les allergènes ?
        </Link>
      </div>
    </section>
  );
}

/**
 * Rappel compact du bandeau, pour l'écran « Aujourd'hui » : le stade en cours et
 * l'essentiel de la semaine, d'un tap vers le planning.
 */
export function WeekBriefingReminder({ briefing }: { briefing: WeekBriefing }) {
  const line =
    briefing.changes.length > 0
      ? briefing.changes.map((c) => c.title).join(" · ")
      : (briefing.tip?.title ?? briefing.stageSummary);

  return (
    <Link
      href="/semaine"
      className="flex items-center gap-3 rounded-lg border border-primary/15 bg-secondary/45 px-4 py-3.5 transition-colors hover:border-primary/40"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-primary shadow-soft">
        <Sparkles className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">
          {briefing.stageTitle}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {line}
        </span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
