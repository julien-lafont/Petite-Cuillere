import Link from "next/link";
import { APP_ALLERGENES_URL, APP_METHODE_URL } from "@/lib/routes";
import {
  ChevronRight,
  Clock,
  CookingPot,
  Droplets,
  HeartHandshake,
  Lightbulb,
  Salad,
  Scale,
  ShieldAlert,
  Sparkles,
  Sprout,
} from "lucide-react";
import type { WeekBriefing, WeekChangeKind } from "@/lib/program/stage";
import { BookOpen } from "lucide-react";
import { Kicker } from "@/components/ui/kicker";

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
 * The programme explanation banner: which stage the child is at on the Sunday of
 * the week shown, and what changes since the previous week. When nothing
 * changes, a tip takes the list's place — in a distinct colour so the change of
 * register is obvious at once.
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

      {/* The banner says what changes this week; this link says why.
          That is where the question comes up, while reading the programme. */}
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-primary/15 pt-4 text-sm">
        <Link
          href={APP_METHODE_URL}
          className="inline-flex items-center gap-1.5 font-medium text-secondary-foreground underline-offset-2 hover:underline"
        >
          <BookOpen className="size-4 shrink-0 text-primary" />
          Comment ce programme est construit
        </Link>
        <Link
          href={APP_ALLERGENES_URL}
          className="inline-flex items-center gap-1.5 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Et les allergènes ?
        </Link>
      </div>
    </section>
  );
}

/**
 * Compact reminder of the banner, for the "Aujourd'hui" screen: the current
 * stage and the gist of the week, one tap from the planner.
 *
 * It is a card in its own right, not a tinted banner: sitting under the day's
 * card, it reuses its background and hairline so the two read as objects of the
 * same kind — the day, then where it sits in the journey. The eyebrow names the
 * child, the only way to say this link is about them and not about the
 * programme in general.
 */
export function WeekBriefingReminder({
  briefing,
  babyName,
}: {
  briefing: WeekBriefing;
  babyName: string;
}) {
  const line =
    briefing.changes.length > 0
      ? briefing.changes.map((c) => c.title).join(" · ")
      : (briefing.tip?.title ?? briefing.stageSummary);

  return (
    <Link
      href="/semaine"
      className="flex items-center gap-4 rounded-lg border bg-card px-5 py-4 shadow-soft transition-colors hover:border-primary/50"
    >
      <span className="grid size-11 shrink-0 place-items-center blob bg-secondary text-secondary-foreground">
        <Sprout className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <Kicker render={<span />} tone="primary" className="block">
          Où en est {babyName}
        </Kicker>
        <span className="block font-heading text-base font-semibold">
          {briefing.stageTitle}
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {line}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-primary" />
    </Link>
  );
}
