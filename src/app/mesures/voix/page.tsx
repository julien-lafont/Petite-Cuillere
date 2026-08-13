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
 * `/mesures/voix` — ce que la chaîne vocale coûte en temps.
 *
 * **Une adresse qu'aucun lien ne donne**, absente du plan du site et en
 * `noindex` — mais ouverte à qui la connaît, sans compte ni liste d'accès. Ce
 * que la page montre ne décrit personne : des durées, des volumes, des noms de
 * modèles. Y mettre une serrure aurait coûté plus cher que ce qu'elle garde.
 *
 * L'adresse ne figure pas non plus dans le `disallow` du `robots.txt` : ce
 * fichier est public, et y écrire un chemin qu'on ne veut pas voir circuler
 * reviendrait à l'annoncer. Le `noindex` ci-dessous suffit à le tenir hors des
 * moteurs.
 *
 * Ce qu'on vient y chercher tient en deux questions, et elles sont dans cet
 * ordre à l'écran :
 *
 *   1. **tient-on le budget de §3.4 ?** Le p90, pas la moyenne — une chaîne
 *      correcte en moyenne et inutilisable une fois sur dix est inutilisable ;
 *   2. **lequel des deux régimes, lequel des modèles ?** C'est la question que
 *      §3.5 laisse explicitement ouverte à la mesure, et le tableau du bas y
 *      répond en découpant par `VOICE_TRANSCRIPTION` et `VOICE_MODEL`.
 */

export const metadata: Metadata = {
  title: "Mesures du vocal",
  robots: { index: false, follow: false },
};

/** Millisecondes → « 2,4 s », parce qu'un budget se lit en secondes. */
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
  const { overview, breakdown, daily } = await getVoiceMetrics(days);

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

      {runs === 0 ? (
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
             * La seule tuile qui peut virer au rouge, et le seul chiffre qui
             * porte un verdict : au-delà de 5 s, §3.4 considère la
             * fonctionnalité morte.
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
    // Un tableau large déborde dans son propre cadre, jamais dans la page.
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
