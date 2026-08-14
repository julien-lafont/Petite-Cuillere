import type { Metadata } from "next";
import Link from "next/link";
import {
  getVoiceMetrics,
  isPeriod,
  PERIODS,
  type Period,
  type VoiceBreakdownRow,
} from "@/lib/data/voice-traces";
import {
  VoiceLatencyChart,
  VoiceUsageChart,
} from "@/components/metrics/voice-charts";
import { StatTile } from "@/components/stats/stat-tile";
import { cn } from "@/lib/utils";

/**
 * `/mesures/voix` — what the voice chain costs in time.
 *
 * **An address no link gives out**, absent from the sitemap and `noindex` — but
 * open to whoever knows it, with no account and no allow-list. What the page
 * shows describes nobody: durations, volumes, model names. Putting a lock on it
 * would have cost more than what it guards.
 *
 * The address is not in `robots.txt`'s `disallow` either: that file is public,
 * and writing a path there that we do not want circulating would amount to
 * announcing it. The `noindex` below is enough to keep it out of search engines.
 *
 * What we come here for fits in two questions, and they are in this order on
 * screen:
 *
 *   1. **are we within the §3.4 budget?** The p90, not the mean — a chain that
 *      is fine on average and unusable one time in ten is unusable;
 *   2. **which of the two modes, which of the models?** That is the question
 *      §3.5 explicitly leaves open to measurement, and the table at the bottom
 *      answers it by splitting on `VOICE_TRANSCRIPTION` and `VOICE_MODEL`.
 */

export const metadata: Metadata = {
  title: "Mesures du vocal",
  robots: { index: false, follow: false },
};

/** Milliseconds → "2,4 s", because a budget is read in seconds. */
function seconds(ms: number | null | undefined) {
  if (ms === null || ms === undefined) return "—";
  return `${(ms / 1000).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} s`;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ jours?: string }>;
}) {
  const { jours } = await searchParams;
  const days: Period = isPeriod(jours) ? (Number(jours) as Period) : PERIODS[0];
  const { overview, breakdown, daily, unreadable } =
    await getVoiceMetrics(days);

  const runs = overview?.runs ?? 0;
  const overBudget = overview?.over_budget ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-10 sm:px-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Mesures du vocal
        </h1>
        <p className="mt-1 text-muted-foreground">
          Une ligne par dictée, sans transcription ni audio : des durées, des
          volumes, le modèle qui a répondu.
        </p>
      </header>

      <nav className="flex gap-2" aria-label="Période">
        {PERIODS.map((period) => (
          <Link
            key={period}
            href={`/mesures/voix?jours=${period}`}
            aria-current={period === days ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
              period === days
                ? "border-primary/30 bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {period} jours
          </Link>
        ))}
      </nav>

      {unreadable ? (
        // Kept apart from the empty case, because an empty page says "nobody
        // dictated" — the one screen here that could pass an outage off as an
        // answer.
        <p className="rounded-xl border border-dashed border-destructive/40 px-5 py-10 text-center text-muted-foreground">
          Les mesures n'ont pas pu être lues. Ce n'est pas qu'il n'y a rien à
          voir — c'est la base qui n'a pas répondu.
        </p>
      ) : runs === 0 ? (
        <p className="rounded-xl border border-dashed px-5 py-10 text-center text-muted-foreground">
          Aucune dictée sur cette période.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile
              label="Dictées"
              value={runs.toLocaleString("fr-FR")}
              sub={`${overview?.households ?? 0} foyer${(overview?.households ?? 0) > 1 ? "s" : ""}`}
            />
            <StatTile
              label="Ressenti médian"
              value={seconds(overview?.p50_perceived)}
              sub={`moyenne ${seconds(overview?.avg_perceived)}`}
            />
            <StatTile
              label="p90 ressenti"
              value={seconds(overview?.p90_perceived)}
              sub={`p95 ${seconds(overview?.p95_perceived)}`}
            />
            {/*
             * The only tile that can turn red, and the only figure that carries
             * a verdict: past 5 s, §3.4 considers the feature dead.
             */}
            <StatTile
              label="Au-delà de 5 s"
              value={`${Math.round((overBudget / runs) * 100)} %`}
              sub={`${overBudget} dictée${overBudget > 1 ? "s" : ""}`}
              tone={overBudget / runs > 0.1 ? "danger" : "default"}
            />
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">
              Le temps que voit le parent
            </h2>
            <p className="text-sm text-muted-foreground">
              De la fin de la parole à la carte affichée — réseau compris, ce
              qu'aucune horloge serveur ne mesure.
            </p>
            <div className="rounded-xl border bg-card p-4">
              <VoiceLatencyChart data={daily} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">
              Les deux moitiés du budget
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <StatTile
                label="Transcription"
                value={seconds(overview?.p50_transcription)}
                sub={`p90 ${seconds(overview?.p90_transcription)}`}
              />
              <StatTile
                label="Compréhension"
                value={seconds(overview?.p50_understanding)}
                sub={`p90 ${seconds(overview?.p90_understanding)}`}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Usage</h2>
            <div className="rounded-xl border bg-card p-4">
              <VoiceUsageChart data={daily} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">
              Par régime et par modèle
            </h2>
            <p className="text-sm text-muted-foreground">
              La question que §3.5 laisse ouverte : c'est ce tableau qui la
              tranche, pas un avis.
            </p>
            <Breakdown rows={breakdown} />
          </section>
        </>
      )}
    </div>
  );
}

function Breakdown({ rows }: { rows: VoiceBreakdownRow[] }) {
  return (
    // A wide table overflows inside its own frame, never in the page.
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Régime</th>
            <th className="px-4 py-2.5 font-medium">Modèle</th>
            <th className="px-4 py-2.5 text-right font-medium">Dictées</th>
            <th className="px-4 py-2.5 text-right font-medium">Ressenti p50</th>
            <th className="px-4 py-2.5 text-right font-medium">Ressenti p90</th>
            <th className="px-4 py-2.5 text-right font-medium">Transcr. p50</th>
            <th className="px-4 py-2.5 text-right font-medium">Compr. p50</th>
            <th className="px-4 py-2.5 text-right font-medium">Cache</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={`${row.mode}·${row.model_id}·${row.effort}`}>
              <td className="px-4 py-2.5 whitespace-nowrap">{row.mode}</td>
              <td className="px-4 py-2.5 whitespace-nowrap">
                {row.model_id ?? "—"}
                {row.effort && (
                  <span className="text-muted-foreground"> · {row.effort}</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {row.runs}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {seconds(row.p50_perceived)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {seconds(row.p90_perceived)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {seconds(row.p50_transcription)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {seconds(row.p50_understanding)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums">
                {row.avg_cache_read?.toLocaleString("fr-FR") ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
