-- ============================================================================
-- Baby Food Tracker — Schéma initial
-- ============================================================================
-- Traduction du modèle de données (docs/functional-spec.md).
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run.
-- Ce script est ré-exécutable sans erreur (idempotent).
--
-- Sécurité : Row Level Security (RLS) activée partout. Chaque aidant n'accède
-- qu'aux données de SON espace partagé (household).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Notre foyer',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  household_id uuid not null references public.households (id) on delete cascade,
  relation text,                       -- père / mère / grand-parent / nounou… (descriptif)
  created_at timestamptz not null default now()
);

create table if not exists public.babies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  prenom text not null,
  date_naissance date not null,
  date_terme date,                     -- terme théorique → âge corrigé
  created_at timestamptz not null default now()
);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade, -- null = catalogue commun
  name text not null,
  category text,                       -- légume / fruit / protéine / féculent / laitier / matière grasse / autre
  age_introduction_min int,            -- en mois
  is_allergen boolean not null default false,
  allergen_type text,
  texture text,
  preparation text,                    -- conseil de préparation (texte libre)
  restrictions text,                   -- ex. « à éviter avant 12 mois »
  quantite_indicative text,
  created_at timestamptz not null default now()
);

create table if not exists public.allergens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade, -- null = catalogue commun
  name text not null,
  type text,
  intro_window text,                   -- fenêtre d'introduction recommandée
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_moments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label text not null,                 -- petit-déjeuner / déjeuner / goûter / dîner…
  position int not null default 0,     -- ordre d'affichage
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  date date not null,
  meal_moment_id uuid references public.meal_moments (id) on delete set null,
  result text check (result in ('bien', 'moyen', 'refuse')), -- null = non renseigné
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade
);

create table if not exists public.meal_allergens (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  allergen_id uuid not null references public.allergens (id) on delete cascade
);

create table if not exists public.intake_observations (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  allergen_id uuid references public.allergens (id) on delete set null,
  food_id uuid references public.foods (id) on delete set null,
  effect_type text,
  severity text,
  delay text,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.food_introductions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  first_tried_on date,
  liked boolean,
  unique (baby_id, food_id)
);

create table if not exists public.allergen_introductions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  allergen_id uuid not null references public.allergens (id) on delete cascade,
  first_tried_on date,
  unique (baby_id, allergen_id)
);

-- ----------------------------------------------------------------------------
-- Fonction utilitaire : household_id de l'utilisateur courant
-- ----------------------------------------------------------------------------

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Nouvel utilisateur → création automatique de son espace + profil + moments
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household_id uuid;
begin
  insert into public.households (name) values ('Notre foyer')
    returning id into new_household_id;

  insert into public.profiles (id, email, household_id)
    values (new.id, new.email, new_household_id);

  -- Moments de repas par défaut (personnalisables ensuite).
  insert into public.meal_moments (household_id, label, position) values
    (new_household_id, 'Petit-déjeuner', 0),
    (new_household_id, 'Déjeuner', 1),
    (new_household_id, 'Goûter', 2),
    (new_household_id, 'Dîner', 3);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.households            enable row level security;
alter table public.profiles              enable row level security;
alter table public.babies                enable row level security;
alter table public.foods                 enable row level security;
alter table public.allergens             enable row level security;
alter table public.meal_moments          enable row level security;
alter table public.meals                 enable row level security;
alter table public.meal_items            enable row level security;
alter table public.meal_allergens        enable row level security;
alter table public.intake_observations   enable row level security;
alter table public.food_introductions    enable row level security;
alter table public.allergen_introductions enable row level security;

-- Espace partagé : l'aidant voit/modifie son foyer.
drop policy if exists "own household" on public.households;
create policy "own household" on public.households
  for all using (id = public.current_household_id())
  with check (id = public.current_household_id());

-- Profils du même foyer visibles ; on ne modifie que le sien.
drop policy if exists "profiles in household" on public.profiles;
create policy "profiles in household" on public.profiles
  for select using (household_id = public.current_household_id());
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

-- Tables rattachées directement à un foyer.
drop policy if exists "babies in household" on public.babies;
create policy "babies in household" on public.babies
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "meal_moments in household" on public.meal_moments;
create policy "meal_moments in household" on public.meal_moments
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- Catalogues : lecture du commun (household_id null) + du foyer ; écriture au foyer.
drop policy if exists "read foods" on public.foods;
create policy "read foods" on public.foods
  for select using (household_id is null or household_id = public.current_household_id());
drop policy if exists "write foods" on public.foods;
create policy "write foods" on public.foods
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "read allergens" on public.allergens;
create policy "read allergens" on public.allergens
  for select using (household_id is null or household_id = public.current_household_id());
drop policy if exists "write allergens" on public.allergens;
create policy "write allergens" on public.allergens
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- Repas : rattachés au foyer via le bébé.
drop policy if exists "meals in household" on public.meals;
create policy "meals in household" on public.meals
  for all using (
    exists (
      select 1 from public.babies b
      where b.id = meals.baby_id and b.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.babies b
      where b.id = meals.baby_id and b.household_id = public.current_household_id()
    )
  );

-- Tables enfant d'un repas : rattachées au foyer via meal → baby.
drop policy if exists "meal_items in household" on public.meal_items;
create policy "meal_items in household" on public.meal_items
  for all using (
    exists (
      select 1 from public.meals m join public.babies b on b.id = m.baby_id
      where m.id = meal_items.meal_id and b.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.meals m join public.babies b on b.id = m.baby_id
      where m.id = meal_items.meal_id and b.household_id = public.current_household_id()
    )
  );

drop policy if exists "meal_allergens in household" on public.meal_allergens;
create policy "meal_allergens in household" on public.meal_allergens
  for all using (
    exists (
      select 1 from public.meals m join public.babies b on b.id = m.baby_id
      where m.id = meal_allergens.meal_id and b.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.meals m join public.babies b on b.id = m.baby_id
      where m.id = meal_allergens.meal_id and b.household_id = public.current_household_id()
    )
  );

drop policy if exists "observations in household" on public.intake_observations;
create policy "observations in household" on public.intake_observations
  for all using (
    exists (
      select 1 from public.meals m join public.babies b on b.id = m.baby_id
      where m.id = intake_observations.meal_id and b.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.meals m join public.babies b on b.id = m.baby_id
      where m.id = intake_observations.meal_id and b.household_id = public.current_household_id()
    )
  );

-- Suivis d'introduction : rattachés au foyer via le bébé.
drop policy if exists "food_introductions in household" on public.food_introductions;
create policy "food_introductions in household" on public.food_introductions
  for all using (
    exists (
      select 1 from public.babies b
      where b.id = food_introductions.baby_id and b.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.babies b
      where b.id = food_introductions.baby_id and b.household_id = public.current_household_id()
    )
  );

drop policy if exists "allergen_introductions in household" on public.allergen_introductions;
create policy "allergen_introductions in household" on public.allergen_introductions
  for all using (
    exists (
      select 1 from public.babies b
      where b.id = allergen_introductions.baby_id and b.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.babies b
      where b.id = allergen_introductions.baby_id and b.household_id = public.current_household_id()
    )
  );
