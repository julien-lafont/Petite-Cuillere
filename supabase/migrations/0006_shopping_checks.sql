-- ============================================================================
-- Baby Food Tracker — Cases cochées de la liste de courses
-- ============================================================================
-- Une ligne = un aliment coché pour une semaine donnée (partagé entre aidants).
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

create table if not exists public.shopping_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (household_id, week_start, food_id)
);

alter table public.shopping_checks enable row level security;

drop policy if exists "shopping in household" on public.shopping_checks;
create policy "shopping in household" on public.shopping_checks
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
