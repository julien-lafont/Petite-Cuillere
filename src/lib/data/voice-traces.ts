import { createClient } from "@/lib/supabase/server";

/**
 * La lecture des mesures du vocal (`voice_traces`).
 *
 * Trois fonctions Postgres font tout le calcul, et ce n'est pas un détail
 * d'implémentation : la médiane et le p90 s'écrivent avec `percentile_cont`, que
 * l'API de données ne sait pas exprimer, et les calculer ici obligerait à
 * rapatrier chaque ligne — donc à faire grossir la page au rythme exact du
 * trafic qu'elle mesure.
 *
 * L'autorisation, elle, n'est pas ici non plus : `voice_traces` n'est lisible
 * que par une adresse inscrite dans `metrics_readers`, et c'est RLS qui le dit.
 * Un appelant qui n'y est pas ne reçoit ni erreur ni fuite — des zéros.
 */

/** Les paliers offerts, en jours. Le premier est le défaut. */
export const PERIODS = [30, 7, 90] as const;
export type Period = (typeof PERIODS)[number];

export function isPeriod(value: unknown): value is Period {
  return (PERIODS as readonly unknown[]).includes(Number(value));
}

export type VoiceOverview = {
  runs: number;
  households: number;
  /** Les dictées au-delà des 5 s de §3.4, celles où la fonctionnalité meurt. */
  over_budget: number;
  avg_perceived: number | null;
  p50_perceived: number | null;
  p90_perceived: number | null;
  p95_perceived: number | null;
  p50_transcription: number | null;
  p90_transcription: number | null;
  p50_understanding: number | null;
  p90_understanding: number | null;
};

export type VoiceBreakdownRow = {
  mode: string;
  model_id: string | null;
  effort: string | null;
  runs: number;
  p50_perceived: number | null;
  p90_perceived: number | null;
  p50_transcription: number | null;
  p90_transcription: number | null;
  p50_understanding: number | null;
  p90_understanding: number | null;
  avg_cache_read: number | null;
};

export type VoiceDailyPoint = {
  day: string;
  runs: number;
  p50_perceived: number | null;
  p90_perceived: number | null;
  p50_transcription: number | null;
  p50_understanding: number | null;
};

/** L'adresse connectée figure-t-elle dans `metrics_readers` ? */
export async function isMetricsReader(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_metrics_reader");
  return data === true;
}

export async function getVoiceMetrics(days: Period) {
  const supabase = await createClient();
  const [overview, breakdown, daily] = await Promise.all([
    supabase.rpc("voice_trace_overview", { since_days: days }),
    supabase.rpc("voice_trace_breakdown", { since_days: days }),
    supabase.rpc("voice_trace_daily", { since_days: days }),
  ]);

  return {
    // Une fonction `returns table` rend toujours un tableau, même quand elle ne
    // décrit qu'une ligne.
    overview: ((overview.data as VoiceOverview[] | null) ?? [])[0] ?? null,
    breakdown: (breakdown.data as VoiceBreakdownRow[] | null) ?? [],
    daily: (daily.data as VoiceDailyPoint[] | null) ?? [],
  };
}
