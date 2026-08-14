import { createClient } from "@/lib/supabase/server";

/**
 * Reading the voice metrics (`voice_traces`).
 *
 * Three Postgres functions do all the maths, and that is not an implementation
 * detail: median and p90 are written with `percentile_cont`, which the data API
 * cannot express, and computing them here would mean pulling every row back —
 * so growing the page at exactly the rate of the traffic it measures.
 *
 * All three are `security definer`, and that is the only way these rows leave
 * the database: RLS grants nobody `select` on `voice_traces`. Not to protect the
 * durations — there is nothing to protect there — but the table carries a
 * `household_id` next to a timestamp, and an aggregate no longer does.
 */

/** The offered windows, in days. The first is the default. */
export const PERIODS = [30, 7, 90] as const;
export type Period = (typeof PERIODS)[number];

export function isPeriod(value: unknown): value is Period {
  return (PERIODS as readonly unknown[]).includes(Number(value));
}

export type VoiceOverview = {
  runs: number;
  households: number;
  /** Dictations past the 5 s of §3.4, the ones where the feature dies. */
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

export async function getVoiceMetrics(days: Period) {
  const supabase = await createClient();
  const [overview, breakdown, daily] = await Promise.all([
    supabase.rpc("voice_trace_overview", { since_days: days }),
    supabase.rpc("voice_trace_breakdown", { since_days: days }),
    supabase.rpc("voice_trace_daily", { since_days: days }),
  ]);

  // A failing aggregate returns `null`, exactly like an aggregate over zero rows:
  // a database without the table, or without the right to call the functions,
  // would otherwise read as "no dictation" — the one screen that can pass an
  // outage off as a result. Hence the flag, and the log line.
  const failure = overview.error ?? breakdown.error ?? daily.error;
  if (failure) console.error("mesures/voix:", failure);

  return {
    // A `returns table` function always yields an array, even when it describes
    // a single row.
    overview: ((overview.data as VoiceOverview[] | null) ?? [])[0] ?? null,
    breakdown: (breakdown.data as VoiceBreakdownRow[] | null) ?? [],
    daily: (daily.data as VoiceDailyPoint[] | null) ?? [],
    unreadable: Boolean(failure),
  };
}
