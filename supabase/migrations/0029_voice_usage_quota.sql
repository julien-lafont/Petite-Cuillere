-- ============================================================================
-- Petite Cuillère — A voice budget per person
-- ============================================================================
-- The three microphone routes (`/api/voix`, `/api/voix/transcrire`,
-- `/api/voix/ecoute`) check that a session exists and nothing else. Every call
-- they accept spends money with a third party: a model call for the first, a
-- Gladia transcription for the other two. The guards that do exist (1 000
-- characters, 4 MB of audio) bound the size of one call, never their number.
--
-- Signup is open, so the cost of looping on them is one email address — and the
-- loop takes the hosting slots with it: the pre-recorded route holds the
-- function open for up to 25 seconds polling Gladia.
--
-- The counter lives here rather than in memory because the functions are
-- stateless and run in parallel; a module variable would count nothing.
--
-- Two bounds, answering two different things:
--   · the day caps the spend;
--   · the minute stops a loop before it saturates the slots.
-- Both are out of a parent's reach: dictating a meal costs two calls (listen,
-- then understand), and a busy day runs to a dozen.
--
-- This does not replace a hard spend cap in each provider's console — that is
-- what stops the bill for good. This is what keeps us from getting there.
--
-- Run in Supabase: SQL Editor → paste → Run. Re-runnable.
-- ============================================================================

-- One row per person, rewritten in place. A row per person per day would leave
-- behind a table of counters nobody wants the morning after.
create table if not exists public.voice_usage (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  -- Fixed-start window: it restarts one minute after its first call rather than
  -- sliding, which would mean keeping timestamps one by one.
  window_started_at timestamptz not null default now(),
  window_calls int not null default 0
);

-- No policy: the table is never read or written through the API. Everything
-- goes through the function below, which is owned by `postgres` and so is
-- subject to neither RLS nor column privileges.
alter table public.voice_usage enable row level security;
revoke all on public.voice_usage from anon, authenticated;

comment on table public.voice_usage is
  'Microphone call counter, per person. Written only by consume_voice_call().';

-- ----------------------------------------------------------------------------
-- Charging a call
-- ----------------------------------------------------------------------------
-- Returns 'ok', 'burst' (too many calls within the minute) or 'daily' (the
-- day's budget is spent). The refusal says which, because "try again in a
-- moment" and "try again tomorrow" are not the same sentence.
--
-- The caps are written here and not passed as arguments: the function is
-- reachable from the API, so a parameter would be chosen by the caller.
--
-- A refused call still counts. Otherwise a loop earns one free call every time
-- a window rolls over, which is exactly the regime it is looking for.

create or replace function public.consume_voice_call()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_cap constant int := 200;
  burst_cap constant int := 20;
  v_uid uuid := auth.uid();
  v_row public.voice_usage;
begin
  if v_uid is null then
    return 'daily';
  end if;

  insert into public.voice_usage as u
    (profile_id, day, calls, window_started_at, window_calls)
    values (v_uid, current_date, 1, now(), 1)
  on conflict (profile_id) do update set
    day = current_date,
    calls = case when u.day = current_date then u.calls + 1 else 1 end,
    window_started_at = case
      when u.window_started_at > now() - interval '1 minute'
      then u.window_started_at else now() end,
    window_calls = case
      when u.window_started_at > now() - interval '1 minute'
      then u.window_calls + 1 else 1 end
  returning * into v_row;

  if v_row.calls > daily_cap then
    return 'daily';
  end if;
  if v_row.window_calls > burst_cap then
    return 'burst';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.consume_voice_call() from anon;
grant execute on function public.consume_voice_call() to authenticated;
