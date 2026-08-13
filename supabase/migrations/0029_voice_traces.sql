-- ============================================================================
-- Petite Cuillère — Keep the voice latencies instead of logging them
-- ============================================================================
-- Every number this table stores was already measured. `/api/voix`,
-- `/api/voix/transcrire` and `/api/voix/ecoute` each end on a `console.info`
-- carrying the latency, the model and the volume — and every one of those lines
-- is unreadable in practice: Vercel keeps runtime logs for one hour on the Hobby
-- plan, and log drains start at Pro. The instrumentation was write-only.
--
-- So the numbers land here instead, one row per dictation, and the question
-- §3.4 asks becomes a query: is the parent served under five seconds, and by
-- which of the two transcription modes. `percentile_cont` answers it; an
-- average alone would hide exactly the tail that kills the feature.
--
-- **No transcript, no audio, no free text.** Only durations, counts and the name
-- of the model that produced them — nothing here describes a child or a meal,
-- which is what makes a table of measurements safe to keep beyond the thirty
-- days §7 grants a transcript.
--
-- Volume: three dictations a day per household. A hundred households fill nine
-- thousand rows a month, well under a megabyte. Retention is therefore a
-- `delete` to run the day it matters, not a mechanism to build now.
--
-- Run in Supabase: SQL Editor → paste → Run. Re-runnable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. One row per dictation
-- ----------------------------------------------------------------------------

create table if not exists public.voice_traces (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Kept to tell one household's dictations from a hundred, never to single one
  -- out. `set null` because a measurement outlives the household it came from.
  household_id uuid references public.households (id) on delete set null,

  -- The dimensions. A latency without them compares to nothing: the whole point
  -- of the table is `group by`, since `VOICE_TRANSCRIPTION` and `VOICE_MODEL`
  -- are the two settings §3.5 leaves open for measurement to settle.
  mode text not null check (mode in ('live', 'pre-recorded', 'typed')),
  model_id text,
  effort text,
  app_version text,

  -- The durations, in milliseconds. All nullable: a typed sentence has no
  -- speech and no transcription, and that absence is data, not a gap to fill
  -- with a zero that would drag every average down.
  speech_ms int check (speech_ms between 0 and 120000),
  transcription_ms int check (transcription_ms between 0 and 120000),
  understanding_ms int check (understanding_ms between 0 and 120000),
  route_ms int check (route_ms between 0 and 120000),
  -- The only one that measures the budget §3.4 actually sets: end of speech →
  -- card on screen. It is the parent's clock, so the browser reports it, and
  -- the four server-side numbers above cannot add up to it — they miss the
  -- network of a phone on 4G in a kitchen.
  perceived_ms int check (perceived_ms between 0 and 120000),

  -- The volume, which is what explains the durations.
  audio_kb int check (audio_kb between 0 and 8192),
  transcript_length int check (transcript_length between 0 and 10000),
  -- Zero, repeated, means the prompt cache break is broken — worth a column of
  -- its own because it moves both the latency and the bill.
  cache_read_tokens int check (cache_read_tokens >= 0),
  intents int check (intents between 0 and 100)
);

comment on table public.voice_traces is
  'Une ligne par dictée : des durées, des volumes, le modèle. Jamais de transcription, jamais d''audio.';

create index if not exists voice_traces_created_at_idx
  on public.voice_traces (created_at desc);

alter table public.voice_traces enable row level security;

-- A member writes into their own household and nothing else. Nothing may go
-- back and rewrite a measurement: a trace is an observation, and an observation
-- that can be edited is not one.
drop policy if exists "insert own household" on public.voice_traces;
create policy "insert own household" on public.voice_traces
  for insert to authenticated
  with check (household_id = public.current_household_id());

-- No select policy, so RLS refuses every row through the Data API. Not to
-- protect the durations — there is nothing in them worth protecting, and the
-- dashboard that reads them is open to anyone holding its address — but because
-- the aggregates below are the whole of what anyone has any use for, and a table
-- reachable row by row would also hand out `household_id` next to a timestamp.
revoke all on public.voice_traces from anon, authenticated;
grant insert on public.voice_traces to authenticated;

-- ----------------------------------------------------------------------------
-- 2. Reading them
-- ----------------------------------------------------------------------------
-- Three functions rather than three `select`s in TypeScript: the Data API
-- cannot express `percentile_cont`, and pulling every row to compute a median
-- in the browser would grow with the traffic it is meant to measure.
--
-- All three are `security definer`, and that is the only way anyone reads this
-- table: RLS grants no select to anybody, so an aggregate is the only shape the
-- measurements come out in. They need no session either — the page they feed
-- opens for whoever holds its address (§8.4).
--
-- The p90 is the number to read, not the average: a chain that is fine on
-- average and unusable one time in ten is unusable.

create or replace function public.voice_trace_overview(since_days int default 30)
returns table (
  runs bigint,
  households bigint,
  over_budget bigint,
  avg_perceived int,
  p50_perceived int,
  p90_perceived int,
  p95_perceived int,
  p50_transcription int,
  p90_transcription int,
  p50_understanding int,
  p90_understanding int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*)::bigint,
    count(distinct t.household_id)::bigint,
    -- §3.4 : « au-delà de 5 secondes, le parent aura fini de taper avant que
    -- l'app ait répondu, et la fonctionnalité meurt. » C'est le seuil, et
    -- c'est ce compte qui dit si on est du bon côté.
    count(*) filter (where t.perceived_ms > 5000)::bigint,
    avg(t.perceived_ms)::int,
    percentile_cont(0.5) within group (order by t.perceived_ms)::int,
    percentile_cont(0.9) within group (order by t.perceived_ms)::int,
    percentile_cont(0.95) within group (order by t.perceived_ms)::int,
    percentile_cont(0.5) within group (order by t.transcription_ms)::int,
    percentile_cont(0.9) within group (order by t.transcription_ms)::int,
    percentile_cont(0.5) within group (order by t.understanding_ms)::int,
    percentile_cont(0.9) within group (order by t.understanding_ms)::int
  from public.voice_traces t
  where t.created_at >= now() - make_interval(days => since_days);
$$;

create or replace function public.voice_trace_breakdown(since_days int default 30)
returns table (
  mode text,
  model_id text,
  effort text,
  runs bigint,
  p50_perceived int,
  p90_perceived int,
  p50_transcription int,
  p90_transcription int,
  p50_understanding int,
  p90_understanding int,
  avg_cache_read int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.mode,
    t.model_id,
    t.effort,
    count(*)::bigint,
    percentile_cont(0.5) within group (order by t.perceived_ms)::int,
    percentile_cont(0.9) within group (order by t.perceived_ms)::int,
    percentile_cont(0.5) within group (order by t.transcription_ms)::int,
    percentile_cont(0.9) within group (order by t.transcription_ms)::int,
    percentile_cont(0.5) within group (order by t.understanding_ms)::int,
    percentile_cont(0.9) within group (order by t.understanding_ms)::int,
    avg(t.cache_read_tokens)::int
  from public.voice_traces t
  where t.created_at >= now() - make_interval(days => since_days)
  group by t.mode, t.model_id, t.effort
  order by count(*) desc;
$$;

-- The day is UTC, like every timestamp stored here. A household's clock matters
-- when the product tells a parent which meal comes next; a measurement is read
-- by one person looking for a trend, and giving each row a different day
-- boundary would only make two dictations incomparable.
create or replace function public.voice_trace_daily(since_days int default 30)
returns table (
  day date,
  runs bigint,
  p50_perceived int,
  p90_perceived int,
  p50_transcription int,
  p50_understanding int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (t.created_at at time zone 'UTC')::date,
    count(*)::bigint,
    percentile_cont(0.5) within group (order by t.perceived_ms)::int,
    percentile_cont(0.9) within group (order by t.perceived_ms)::int,
    percentile_cont(0.5) within group (order by t.transcription_ms)::int,
    percentile_cont(0.5) within group (order by t.understanding_ms)::int
  from public.voice_traces t
  where t.created_at >= now() - make_interval(days => since_days)
  -- L'expression est répétée plutôt qu'aliasée : `day` est aussi le nom d'une
  -- colonne de sortie, et Postgres jugerait la référence ambiguë.
  group by (t.created_at at time zone 'UTC')::date
  order by (t.created_at at time zone 'UTC')::date;
$$;
