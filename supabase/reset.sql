-- ============================================================================
-- Baby Food Tracker — RESET TOTAL (données de test)
-- ============================================================================
-- ⚠️ DESTRUCTIF : supprime TOUTES les données applicatives (foyers, bébés, repas,
-- catalogue…) et recrée tout à neuf. Les comptes (auth.users) sont conservés :
-- ce script rattache automatiquement les utilisateurs existants à un foyer neuf.
--
-- Usage : Supabase → SQL Editor → coller ce fichier → Run.
-- Source de vérité unique : consolide les migrations 0001 → 0013 depuis zéro
-- (schéma, catalogue, saisonnalité, ordre d'introduction, préparation, réactions,
-- lecture publique du catalogue).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Suppression
-- ----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.current_household_id() cascade;
drop function if exists public.is_household_owner() cascade;
drop function if exists public.invitation_details(uuid) cascade;
drop function if exists public.get_invitation_token(uuid) cascade;
drop function if exists public.accept_invitation(uuid) cascade;
drop function if exists public.remove_helper(uuid) cascade;

drop table if exists public.invitations cascade;
drop table if exists public.shopping_checks cascade;
drop table if exists public.allergen_introductions cascade;
drop table if exists public.food_introductions cascade;
drop table if exists public.intake_observations cascade;
drop table if exists public.meal_allergens cascade;
drop table if exists public.meal_items cascade;
drop table if exists public.meals cascade;
drop table if exists public.meal_moments cascade;
drop table if exists public.allergens cascade;
drop table if exists public.foods cascade;
drop table if exists public.babies cascade;
drop table if exists public.profiles cascade;
drop table if exists public.households cascade;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Notre foyer',
  owner_id uuid,                       -- responsable = premier inscrit (FK ajoutée plus bas)
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  household_id uuid not null references public.households (id) on delete cascade,
  prenom text,                         -- nom d'affichage de l'aidant
  relation text,                       -- rôle auprès de l'enfant ; « Parent » par défaut pour le responsable
  created_at timestamptz not null default now()
);

alter table public.households
  add constraint households_owner_fk
  foreign key (owner_id) references public.profiles (id) on delete set null;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  prenom text not null,
  relation text,
  token uuid not null default gen_random_uuid() unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null
);

create table public.babies (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  -- Forme canonique posée par l'application (`src/lib/prenom.ts`) : une
  -- majuscule par composante, le reste en minuscules.
  prenom text not null check (char_length(prenom) between 1 and 50),
  date_naissance date not null,
  date_terme date,
  age_reference_date date,
  avatar_color text,                   -- clé de teinte de la pastille ; null = défaut
  sexe text check (sexe in ('fille', 'garcon')),  -- null = non renseigné → masculin au rendu
  created_at timestamptz not null default now()
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  name text not null,
  category text,
  age_introduction_min int,
  is_allergen boolean not null default false,
  allergen_type text,
  texture text,
  preparation text,
  restrictions text,
  quantite_indicative text,
  cook_minutes int,                    -- durée de cuisson vapeur (0 = aucune cuisson)
  prep_note text,                      -- geste de préparation préalable (impératif)
  season jsonb,
  intro_order int,
  created_at timestamptz not null default now()
);

create table public.allergens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  name text not null,
  type text,
  intro_window text,
  note text,
  created_at timestamptz not null default now()
);

create table public.meal_moments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  date date not null,
  meal_moment_id uuid references public.meal_moments (id) on delete set null,
  result text check (result in ('bien', 'moyen', 'refuse')),
  note text,
  created_at timestamptz not null default now()
);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade
);

create table public.meal_allergens (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  allergen_id uuid not null references public.allergens (id) on delete cascade
);

create table public.intake_observations (
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

create table public.food_introductions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  first_tried_on date,
  liked boolean,
  unique (baby_id, food_id)
);

create table public.allergen_introductions (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  allergen_id uuid not null references public.allergens (id) on delete cascade,
  first_tried_on date,
  had_reaction boolean not null default false, -- une réaction a-t-elle été observée ?
  unique (baby_id, allergen_id)
);

create table public.shopping_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start date not null,
  food_id uuid not null references public.foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (household_id, week_start, food_id)
);

-- ----------------------------------------------------------------------------
-- 3. Fonctions & déclencheur
-- ----------------------------------------------------------------------------
create function public.current_household_id()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid();
$$;

create function public.is_household_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.households h
    where h.id = public.current_household_id() and h.owner_id = auth.uid()
  );
$$;

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_household_id uuid;
begin
  insert into public.households (name) values ('Notre foyer') returning id into new_household_id;
  -- « Parent » : rôle par défaut du responsable, qui crée le foyer pour son
  -- enfant. Sans lui, la liste des aidants se rabattrait sur son email.
  insert into public.profiles (id, email, household_id, relation)
    values (new.id, new.email, new_household_id, 'Parent');
  update public.households set owner_id = new.id where id = new_household_id;
  insert into public.meal_moments (household_id, label, position) values
    (new_household_id, 'Petit-déjeuner', 0),
    (new_household_id, 'Déjeuner', 1),
    (new_household_id, 'Goûter', 2),
    (new_household_id, 'Dîner', 3);
  return new;
end;
$$;

create function public.invitation_details(invite_token uuid)
returns table (prenom text, relation text, household_name text, is_pending boolean)
language sql stable security definer set search_path = public as $$
  select i.prenom, i.relation, h.name, (i.accepted_at is null)
  from public.invitations i
  join public.households h on h.id = i.household_id
  where i.token = invite_token;
$$;
grant execute on function public.invitation_details(uuid) to anon, authenticated;

create function public.get_invitation_token(invitation_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select token from public.invitations
  where id = invitation_id
    and household_id = public.current_household_id()
    and public.is_household_owner();
$$;
grant execute on function public.get_invitation_token(uuid) to authenticated;

create function public.accept_invitation(invite_token uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations;
  v_old_household uuid;
  v_old_profiles int;
  v_old_babies int;
begin
  if v_uid is null then raise exception 'non authentifié'; end if;
  select * into v_inv from public.invitations where token = invite_token and accepted_at is null;
  if not found then raise exception 'invitation invalide ou déjà utilisée'; end if;
  select household_id into v_old_household from public.profiles where id = v_uid;
  if v_old_household = v_inv.household_id then
    update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
    return;
  end if;
  update public.profiles
    set household_id = v_inv.household_id, prenom = v_inv.prenom, relation = v_inv.relation
    where id = v_uid;
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  select count(*) into v_old_profiles from public.profiles where household_id = v_old_household;
  select count(*) into v_old_babies from public.babies where household_id = v_old_household;
  if v_old_profiles = 0 and v_old_babies = 0 then
    delete from public.households where id = v_old_household;
  end if;
end;
$$;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- Révocation complète : suppression du compte (cascade sur profiles).
create function public.remove_helper(target_profile uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_household uuid := public.current_household_id();
  v_target_household uuid;
begin
  if not public.is_household_owner() then raise exception 'réservé au responsable du foyer'; end if;
  if target_profile = auth.uid() then raise exception 'le responsable ne peut pas se retirer lui-même'; end if;
  select household_id into v_target_household from public.profiles where id = target_profile;
  if v_target_household is null or v_target_household <> v_household then
    raise exception 'aidant introuvable dans ce foyer';
  end if;
  delete from auth.users where id = target_profile;
end;
$$;
grant execute on function public.remove_helper(uuid) to authenticated;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 4. Rattrapage des comptes déjà existants (foyer + profil + moments)
-- ----------------------------------------------------------------------------
do $$
declare u record; hid uuid;
begin
  for u in select id, email from auth.users loop
    insert into public.households (name) values ('Notre foyer') returning id into hid;
    insert into public.profiles (id, email, household_id, relation)
      values (u.id, u.email, hid, 'Parent');
    update public.households set owner_id = u.id where id = hid;
    insert into public.meal_moments (household_id, label, position) values
      (hid, 'Petit-déjeuner', 0), (hid, 'Déjeuner', 1), (hid, 'Goûter', 2), (hid, 'Dîner', 3);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 5. Row Level Security
-- ----------------------------------------------------------------------------
alter table public.households            enable row level security;
alter table public.profiles              enable row level security;
alter table public.invitations           enable row level security;
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
alter table public.shopping_checks       enable row level security;

create policy "own household" on public.households
  for all using (id = public.current_household_id()) with check (id = public.current_household_id());
create policy "profiles in household" on public.profiles
  for select using (household_id = public.current_household_id());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid());

-- Invitations : visibles par les membres (tags), gérées par le responsable.
-- La colonne `token` est masquée via les privilèges (lisible seulement par le
-- responsable, au travers de get_invitation_token).
create policy "invitations in household" on public.invitations
  for select using (household_id = public.current_household_id());
create policy "owner inserts invitations" on public.invitations
  for insert with check (household_id = public.current_household_id() and public.is_household_owner());
create policy "owner deletes invitations" on public.invitations
  for delete using (household_id = public.current_household_id() and public.is_household_owner());
revoke all on public.invitations from anon;
revoke select on public.invitations from authenticated;
grant select (id, household_id, prenom, relation, created_by, created_at, accepted_at, accepted_by)
  on public.invitations to authenticated;
grant insert, delete on public.invitations to authenticated;

create policy "babies in household" on public.babies
  for all using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());
create policy "meal_moments in household" on public.meal_moments
  for all using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());
create policy "read foods" on public.foods
  for select using (household_id is null or household_id = public.current_household_id());
create policy "write foods" on public.foods
  for all using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());
create policy "read allergens" on public.allergens
  for select using (household_id is null or household_id = public.current_household_id());
create policy "write allergens" on public.allergens
  for all using (household_id = public.current_household_id()) with check (household_id = public.current_household_id());

-- Entrée publique (/decouvrir) : un visiteur non connecté calcule le programme
-- de son bébé côté client et doit donc lire le catalogue commun.
-- La RLS reste active : `current_household_id()` vaut null pour un anonyme,
-- seules les lignes `household_id is null` lui sont visibles. Aucune donnée de
-- foyer n'est exposée. Voir 0010_public_catalog_read.sql.
grant select on public.foods to anon;
grant select on public.allergens to anon;
create policy "meals in household" on public.meals
  for all using (exists (select 1 from public.babies b where b.id = meals.baby_id and b.household_id = public.current_household_id()))
  with check (exists (select 1 from public.babies b where b.id = meals.baby_id and b.household_id = public.current_household_id()));
create policy "meal_items in household" on public.meal_items
  for all using (exists (select 1 from public.meals m join public.babies b on b.id = m.baby_id where m.id = meal_items.meal_id and b.household_id = public.current_household_id()))
  with check (exists (select 1 from public.meals m join public.babies b on b.id = m.baby_id where m.id = meal_items.meal_id and b.household_id = public.current_household_id()));
create policy "meal_allergens in household" on public.meal_allergens
  for all using (exists (select 1 from public.meals m join public.babies b on b.id = m.baby_id where m.id = meal_allergens.meal_id and b.household_id = public.current_household_id()))
  with check (exists (select 1 from public.meals m join public.babies b on b.id = m.baby_id where m.id = meal_allergens.meal_id and b.household_id = public.current_household_id()));
create policy "observations in household" on public.intake_observations
  for all using (exists (select 1 from public.meals m join public.babies b on b.id = m.baby_id where m.id = intake_observations.meal_id and b.household_id = public.current_household_id()))
  with check (exists (select 1 from public.meals m join public.babies b on b.id = m.baby_id where m.id = intake_observations.meal_id and b.household_id = public.current_household_id()));
create policy "food_introductions in household" on public.food_introductions
  for all using (exists (select 1 from public.babies b where b.id = food_introductions.baby_id and b.household_id = public.current_household_id()))
  with check (exists (select 1 from public.babies b where b.id = food_introductions.baby_id and b.household_id = public.current_household_id()));
create policy "allergen_introductions in household" on public.allergen_introductions
  for all using (exists (select 1 from public.babies b where b.id = allergen_introductions.baby_id and b.household_id = public.current_household_id()))
  with check (exists (select 1 from public.babies b where b.id = allergen_introductions.baby_id and b.household_id = public.current_household_id()));

create policy "shopping in household" on public.shopping_checks
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ----------------------------------------------------------------------------
-- 6. Catalogue commun (aliments + allergènes) — voir 0002_seed_catalog.sql
-- ----------------------------------------------------------------------------
insert into public.foods
  (name, category, age_introduction_min, is_allergen, allergen_type, texture, preparation, restrictions, quantite_indicative)
values
  ('Carotte', 'légume', 4, false, null, 'Cuite, finement mixée', 'Vapeur puis mixer. Bio conseillé (nitrates). Un seul légume/jour au début.', null, null),
  ('Haricot vert', 'légume', 4, false, null, 'Cuit, finement mixé', 'Vapeur puis mixer.', null, null),
  ('Courgette', 'légume', 4, false, null, 'Cuite, finement mixée', 'Épépiner, cuire, mixer.', null, null),
  ('Potiron', 'légume', 4, false, null, 'Cuit, finement mixé', 'Vapeur puis mixer.', null, null),
  ('Courge', 'légume', 4, false, null, 'Cuite, finement mixée', 'Vapeur puis mixer.', null, null),
  ('Épinard', 'légume', 4, false, null, 'Cuit, finement mixé', 'Cuire puis mixer. Bio conseillé (nitrates).', null, null),
  ('Blanc de poireau', 'légume', 4, false, null, 'Cuit, finement mixé', 'Cuire puis mixer.', null, null),
  ('Brocoli', 'légume', 4, false, null, 'Cuit, finement mixé', 'Vapeur puis mixer.', null, null),
  ('Panais', 'légume', 4, false, null, 'Cuit, écrasé', 'Vapeur puis écraser.', null, null),
  ('Petits pois', 'légume', 4, false, null, 'Cuits, mixés', 'Cuire, mixer et passer pour retirer les peaux.', null, null),
  ('Chou', 'légume', 4, false, null, 'Cuit, mixé', 'Peut être plus fort en goût : introduire progressivement.', null, null),
  ('Navet', 'légume', 4, false, null, 'Cuit, mixé', 'Vapeur puis mixer.', null, null),
  ('Fenouil', 'légume', 4, false, null, 'Cuit, mixé', 'Vapeur puis mixer.', null, null),
  ('Pomme', 'fruit', 4, false, null, 'Cuite, mixée', 'Compote sans sucre. Crue râpée plus tard.', null, null),
  ('Poire', 'fruit', 4, false, null, 'Cuite, mixée', 'Compote sans sucre.', null, null),
  ('Banane', 'fruit', 4, false, null, 'Écrasée', 'Bien mûre, écrasée à la fourchette.', null, null),
  ('Abricot', 'fruit', 4, false, null, 'Cuit, mixé', 'Compote sans sucre.', null, null),
  ('Pêche', 'fruit', 4, false, null, 'Cuite, mixée', 'Compote sans sucre.', null, null),
  ('Fraise', 'fruit', 4, false, null, 'Écrasée', 'Sans sucre. Couper si morceaux.', null, null),
  ('Myrtille', 'fruit', 4, false, null, 'Écrasée, mixée', 'Sans sucre.', null, null),
  ('Poulet', 'protéine', 4, false, null, 'Cuit, mixé', 'Cuire sans matière grasse, mixer avec des légumes. Bien cuit.', null, '10 g/jour par année d''âge (2 c. à café)'),
  ('Bœuf', 'protéine', 4, false, null, 'Cuit, mixé', 'Riche en fer. Bien cuit, mixé finement.', null, '10 g/jour par année d''âge'),
  ('Jambon blanc', 'protéine', 4, false, null, 'Mixé', 'Découenné, dégraissé, mixé. Reste salé.', null, '10 g/jour par année d''âge'),
  ('Poisson blanc', 'protéine', 4, true, 'poisson', 'Cuit, émietté', 'Maigre (colin, cabillaud, merlan). Vapeur, sans arêtes. Non pané.', 'Limiter thon, espadon (métaux lourds).', '10 g/jour par année d''âge, 1×/sem'),
  ('Poisson gras (sardine, maquereau)', 'protéine', 4, true, 'poisson', 'Cuit, émietté', 'Riche en oméga-3. Bien cuit, sans arêtes.', 'Poisson gras 1×/semaine. Éviter gros prédateurs.', '10 g/jour par année d''âge'),
  ('Œuf dur', 'protéine', 4, true, 'œuf', 'Écrasé', 'Jaune + blanc, bien cuit (dur). ¼ d''œuf ≈ 10 g de viande.', 'Jamais cru ou peu cuit avant 5 ans.', 'commencer petit'),
  ('Petit-suisse', 'laitier', 5, false, null, 'Lisse', 'Préférer les laitages bébé (lait 2e âge).', null, null),
  ('Yaourt bébé', 'laitier', 6, false, null, 'Lisse', 'Préférer les laitages bébé.', null, null),
  ('Fromage blanc', 'laitier', 6, false, null, 'Lisse', 'Préférer les laitages bébé.', null, null),
  ('Fromage à pâte pressée', 'laitier', 9, false, null, 'Râpé/petits morceaux', 'Vers 9 mois (gruyère, comté). Cuit à cœur.', 'Fromages au lait cru exclus avant 5 ans (sauf pâtes pressées cuites).', null),
  ('Semoule', 'féculent', 6, true, 'gluten', 'Fine', 'Gluten introduit progressivement.', null, null),
  ('Riz', 'féculent', 6, false, null, 'Bien cuit, mixé', 'Bien cuire puis mixer.', null, null),
  ('Pâtes', 'féculent', 6, true, 'gluten', 'Bien cuites, coupées', 'Gluten. Bien cuire, couper finement.', null, null),
  ('Pomme de terre', 'féculent', 6, false, null, 'Cuite, écrasée', 'Souvent associée aux légumes.', null, null),
  ('Patate douce', 'féculent', 6, false, null, 'Cuite, écrasée', 'Vapeur puis écraser.', null, null),
  ('Lentilles', 'féculent', 6, false, null, 'Mixées', 'Légumes secs uniquement mixés.', null, null),
  ('Pois chiches', 'féculent', 6, false, null, 'Mixés', 'Légumes secs uniquement mixés.', null, null),
  ('Pain', 'féculent', 6, true, 'gluten', 'Croûte à mâchouiller', 'Croûte de pain dans la main dès 6 mois, sous surveillance. Gluten.', null, null),
  ('Huile de colza', 'matière grasse', 4, false, null, 'Crue', '1 à 2 c. à café par année d''âge, crue, dans les légumes. Bon équilibre oméga-3/6.', null, '1 à 2 c. à café par année d''âge'),
  ('Huile de noix', 'matière grasse', 4, false, null, 'Crue', 'Crue, alterner avec le colza. Bon équilibre oméga-3/6.', null, null),
  ('Beurre', 'matière grasse', 4, false, null, 'Frais', 'Une noisette, à alterner avec l''huile.', null, null),
  ('Beurre de cacahuète', 'autre', 4, true, 'arachide', 'Dilué / en poudre', 'Introduire tôt (4-6 mois) en poudre dans compote/yaourt/gâteau, progressivement.', 'Jamais de cacahuète entière avant 3 ans (fausse route).', '2 g puis augmenter'),
  ('Miel', 'autre', 12, false, null, null, 'À réserver après 12 mois.', 'Interdit avant 12 mois (botulisme).', null);

insert into public.allergens (name, type, intro_window, note)
values
  ('Arachide', 'oléagineux', 'dès 4-6 mois', 'En poudre dans compote/yaourt/gâteau. Jamais entière avant 3 ans.'),
  ('Gluten', 'céréale', 'dès 4-6 mois', 'Dès le début de la diversification, en quantités progressives.'),
  ('Œuf', 'protéine', 'dès 4-6 mois', 'Bien cuit (dur) au début.'),
  ('Poisson', 'protéine', 'dès 4-6 mois', 'Cuit, non pané. Limiter les espèces à métaux lourds.'),
  ('Fruits à coque', 'oléagineux', 'dès 4-6 mois', 'En poudre. Jamais entiers avant 3 ans.'),
  ('Lait de vache', 'protéine', 'dès 4-6 mois', 'Via les laitages bébé.'),
  ('Soja', 'légumineuse', 'dès 4-6 mois', 'Allergène introduit tôt, mais soja aliment déconseillé avant 3 ans (phyto-estrogènes).'),
  ('Fruits de mer', 'protéine', 'dès 4-6 mois', 'Cuits, provenant d''une zone d''élevage autorisée.'),
  ('Sésame', 'graine', 'dès 4-6 mois', 'En purée ou en poudre.');

-- ----------------------------------------------------------------------------
-- 7. Saisonnalité (France) — voir 0004_food_season.sql
-- ----------------------------------------------------------------------------
update public.foods set season = '[[5,11]]'        where name = 'Carotte' and household_id is null;
update public.foods set season = '[[6,9]]'         where name = 'Haricot vert' and household_id is null;
update public.foods set season = '[[6,9]]'         where name = 'Courgette' and household_id is null;
update public.foods set season = '[[9,12]]'        where name = 'Potiron' and household_id is null;
update public.foods set season = '[[9,12]]'        where name = 'Courge' and household_id is null;
update public.foods set season = '[[3,6],[9,11]]'  where name = 'Épinard' and household_id is null;
update public.foods set season = '[[1,4],[9,12]]'  where name = 'Blanc de poireau' and household_id is null;
update public.foods set season = '[[6,11]]'        where name = 'Brocoli' and household_id is null;
update public.foods set season = '[[1,2],[10,12]]' where name = 'Panais' and household_id is null;
update public.foods set season = '[[5,7]]'         where name = 'Petits pois' and household_id is null;
update public.foods set season = '[[1,3],[9,12]]'  where name = 'Chou' and household_id is null;
update public.foods set season = '[[1,3],[10,12]]' where name = 'Navet' and household_id is null;
update public.foods set season = '[[6,10]]'        where name = 'Fenouil' and household_id is null;
update public.foods set season = '[[8,11]]'        where name = 'Pomme' and household_id is null;
update public.foods set season = '[[8,11]]'        where name = 'Poire' and household_id is null;
update public.foods set season = '[[6,8]]'         where name = 'Abricot' and household_id is null;
update public.foods set season = '[[6,9]]'         where name = 'Pêche' and household_id is null;
update public.foods set season = '[[5,7]]'         where name = 'Fraise' and household_id is null;
update public.foods set season = '[[7,9]]'         where name = 'Myrtille' and household_id is null;

-- ----------------------------------------------------------------------------
-- 8. Ordre de découverte (guide Aiguelongue) — voir 0005_food_intro_order.sql
-- ----------------------------------------------------------------------------
update public.foods set intro_order = 1  where name = 'Carotte' and household_id is null;
update public.foods set intro_order = 2  where name = 'Épinard' and household_id is null;
update public.foods set intro_order = 3  where name = 'Haricot vert' and household_id is null;
update public.foods set intro_order = 4  where name = 'Courgette' and household_id is null;
update public.foods set intro_order = 5  where name = 'Courge' and household_id is null;
update public.foods set intro_order = 6  where name = 'Potiron' and household_id is null;
update public.foods set intro_order = 7  where name = 'Blanc de poireau' and household_id is null;
update public.foods set intro_order = 8  where name = 'Brocoli' and household_id is null;
update public.foods set intro_order = 9  where name = 'Panais' and household_id is null;
update public.foods set intro_order = 10 where name = 'Petits pois' and household_id is null;
update public.foods set intro_order = 21 where name = 'Chou' and household_id is null;
update public.foods set intro_order = 22 where name = 'Navet' and household_id is null;
update public.foods set intro_order = 23 where name = 'Fenouil' and household_id is null;
update public.foods set intro_order = 1  where name = 'Pomme' and household_id is null;
update public.foods set intro_order = 2  where name = 'Poire' and household_id is null;
update public.foods set intro_order = 3  where name = 'Banane' and household_id is null;
update public.foods set intro_order = 4  where name = 'Abricot' and household_id is null;
update public.foods set intro_order = 5  where name = 'Pêche' and household_id is null;
update public.foods set intro_order = 6  where name = 'Fraise' and household_id is null;
update public.foods set intro_order = 7  where name = 'Myrtille' and household_id is null;

-- ----------------------------------------------------------------------------
-- 9. Préparation (cuisson + geste préalable) — voir 0008_food_preparation.sql
--    Suppose un cuiseur-mixeur type Babycook. Morceaux de 1 à 2 cm.
-- ----------------------------------------------------------------------------
-- Légumes
update public.foods set cook_minutes = 20, prep_note = 'Épluche et coupe en rondelles fines' where household_id is null and name = 'Carotte';
update public.foods set cook_minutes = 15, prep_note = 'Équeute et coupe en tronçons' where household_id is null and name = 'Haricot vert';
update public.foods set cook_minutes = 12, prep_note = 'Épluche, épépine et coupe en dés' where household_id is null and name = 'Courgette';
update public.foods set cook_minutes = 15, prep_note = 'Épluche, épépine et coupe en cubes' where household_id is null and name = 'Potiron';
update public.foods set cook_minutes = 15, prep_note = 'Épluche, épépine et coupe en cubes' where household_id is null and name = 'Courge';
update public.foods set cook_minutes = 10, prep_note = 'Lave et retire les grosses tiges' where household_id is null and name = 'Épinard';
update public.foods set cook_minutes = 15, prep_note = 'Garde le blanc seul, lave-le bien et émince' where household_id is null and name = 'Blanc de poireau';
update public.foods set cook_minutes = 12, prep_note = 'Détaille en petits bouquets' where household_id is null and name = 'Brocoli';
update public.foods set cook_minutes = 15, prep_note = 'Épluche et coupe en rondelles' where household_id is null and name = 'Panais';
update public.foods set cook_minutes = 12, prep_note = 'Rince (frais ou surgelés, les deux conviennent)' where household_id is null and name = 'Petits pois';
update public.foods set cook_minutes = 15, prep_note = 'Retire le trognon et émince finement' where household_id is null and name = 'Chou';
update public.foods set cook_minutes = 15, prep_note = 'Épluche et coupe en cubes' where household_id is null and name = 'Navet';
update public.foods set cook_minutes = 15, prep_note = 'Retire les tiges dures et émince le bulbe' where household_id is null and name = 'Fenouil';
-- Fruits
update public.foods set cook_minutes = 10, prep_note = 'Épluche, retire le cœur et coupe en morceaux' where household_id is null and name = 'Pomme';
update public.foods set cook_minutes = 8,  prep_note = 'Épluche, retire le cœur et coupe en morceaux' where household_id is null and name = 'Poire';
update public.foods set cook_minutes = 0,  prep_note = 'Choisis-la bien mûre et écrase-la à la fourchette' where household_id is null and name = 'Banane';
update public.foods set cook_minutes = 8,  prep_note = 'Dénoyaute et coupe en quartiers' where household_id is null and name = 'Abricot';
update public.foods set cook_minutes = 8,  prep_note = 'Épluche, dénoyaute et coupe en quartiers' where household_id is null and name = 'Pêche';
update public.foods set cook_minutes = 0,  prep_note = 'Équeute, lave et mixe crue (bien mûre)' where household_id is null and name = 'Fraise';
update public.foods set cook_minutes = 5,  prep_note = 'Rince (une cuisson courte facilite le mixage)' where household_id is null and name = 'Myrtille';
-- Protéines
update public.foods set cook_minutes = 15, prep_note = 'Retire la peau et le gras, coupe en dés' where household_id is null and name = 'Poulet';
update public.foods set cook_minutes = 15, prep_note = 'Coupe en petits dés, sans gras' where household_id is null and name = 'Bœuf';
update public.foods set cook_minutes = 0,  prep_note = 'Découenne et retire le gras (déjà cuit)' where household_id is null and name = 'Jambon blanc';
update public.foods set cook_minutes = 10, prep_note = 'Vérifie l''absence d''arêtes, coupe en morceaux' where household_id is null and name = 'Poisson blanc';
update public.foods set cook_minutes = 10, prep_note = 'Vérifie l''absence d''arêtes, coupe en morceaux' where household_id is null and name = 'Poisson gras (sardine, maquereau)';
update public.foods set cook_minutes = 10, prep_note = 'Cuis-le dur (10 min à l''eau bouillante), jaune et blanc' where household_id is null and name = 'Œuf dur';
-- Féculents
update public.foods set cook_minutes = 5,  prep_note = 'Verse en pluie dans du liquide chaud' where household_id is null and name = 'Semoule';
update public.foods set cook_minutes = 20, prep_note = 'Rince, puis cuis dans un grand volume d''eau' where household_id is null and name = 'Riz';
update public.foods set cook_minutes = 10, prep_note = 'Choisis de petites formes et cuis-les bien tendres' where household_id is null and name = 'Pâtes';
update public.foods set cook_minutes = 20, prep_note = 'Épluche et coupe en cubes' where household_id is null and name = 'Pomme de terre';
update public.foods set cook_minutes = 20, prep_note = 'Épluche et coupe en cubes' where household_id is null and name = 'Patate douce';
update public.foods set cook_minutes = 25, prep_note = 'Rince abondamment' where household_id is null and name = 'Lentilles';
update public.foods set cook_minutes = 10, prep_note = 'En conserve : rince bien et retire les peaux' where household_id is null and name = 'Pois chiches';
update public.foods set cook_minutes = 0,  prep_note = 'Donne la croûte ou un morceau de mie, sous surveillance' where household_id is null and name = 'Pain';
-- Laitiers, matières grasses, divers (aucune cuisson)
update public.foods set cook_minutes = 0, prep_note = 'Sers-le nature, sans sucre ajouté' where household_id is null and name in ('Petit-suisse', 'Yaourt bébé', 'Fromage blanc');
update public.foods set cook_minutes = 0, prep_note = 'Râpe finement (pâte pressée cuite uniquement)' where household_id is null and name = 'Fromage à pâte pressée';
update public.foods set cook_minutes = 0, prep_note = 'Ajoute-la crue, hors cuisson, juste avant de servir' where household_id is null and name in ('Huile de colza', 'Huile de noix');
update public.foods set cook_minutes = 0, prep_note = 'Ajoute-le hors cuisson, juste avant de servir' where household_id is null and name = 'Beurre';
update public.foods set cook_minutes = 0, prep_note = 'Une pointe diluée dans une purée ou un laitage — jamais de cacahuète entière' where household_id is null and name = 'Beurre de cacahuète';
update public.foods set cook_minutes = 0, prep_note = 'Interdit avant 12 mois (botulisme)' where household_id is null and name = 'Miel';
