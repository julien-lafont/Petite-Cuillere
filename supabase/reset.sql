-- ============================================================================
-- Baby Food Tracker — RESET TOTAL (données de test)
-- ============================================================================
-- ⚠️ DESTRUCTIF : supprime TOUTES les données applicatives (foyers, bébés, repas,
-- catalogue…) et recrée tout à neuf. Les comptes (auth.users) sont conservés :
-- ce script rattache automatiquement les utilisateurs existants à un foyer neuf.
--
-- Usage : Supabase → SQL Editor → coller ce fichier → Run.
-- Source de vérité unique : consolide les migrations 0001 → 0017 depuis zéro
-- (schéma, catalogue, saisonnalité, ordre d'introduction, préparation, réactions,
-- lecture publique du catalogue, ancienneté de diversification, protocole
-- allergènes et suivi du réel).
--
-- Contrairement aux migrations, ce script part d'une base vide : il pose donc
-- l'état final directement, au lieu de rejouer les corrections successives.
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
-- `btree_gist` mêle l'égalité (household_id) et le chevauchement (int4range)
-- dans la contrainte d'exclusion des créneaux de repas.
create extension if not exists btree_gist;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Notre foyer',
  owner_id uuid,                       -- responsable = premier inscrit (FK ajoutée plus bas)
  -- L'horloge du foyer, et non celle de l'appareil : les repas ont lieu chez
  -- l'enfant, un aidant en déplacement doit voir la journée du bébé (cf. 0022).
  timezone text not null default 'Europe/Paris',
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
  -- Date réelle du premier aliment solide (null = pas encore commencé). Mesure
  -- l'ancienneté de diversification, qui pilote la rampe d'ouverture des repas
  -- indépendamment de l'âge.
  diversification_started_on date,
  -- Dermatite atopique sévère ou allergie à l'œuf connue : le protocole LEAP
  -- demande un avis médical avant l'arachide.
  atopic_risk boolean not null default false,
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
  cook_minutes int,                    -- durée de cuisson (0 = aucune cuisson)
  -- Geste de préparation, à l'impératif. Pour `cook_method = 'eau'`, la note
  -- porte la cuisson entière (durée comprise) : le pas-à-pas n'en ajoute pas une
  -- seconde, sans quoi l'œuf dur repartirait à la vapeur. Voir 0019.
  prep_note text,
  cook_method text check (cook_method is null or cook_method in ('vapeur', 'eau', 'aucune')),
  -- Préparation d'accueil. NULL = l'aliment se sert seul (laitage, croûte de
  -- pain). C'est ce qui sépare la purée salée de la compote.
  course text check (course is null or course in ('salé', 'sucré')),
  served_apart boolean not null default false,  -- se sert tel quel, jamais mixé
  -- Portion propre à l'aliment, quand la règle par catégorie ne veut rien dire :
  -- un pruneau est bien un dessert, mais on n'en donne pas 180 g. Troisième et
  -- dernière source de quantité, après la dose du protocole allergènes et
  -- `portionFor` (src/lib/portions.ts). NULL = règle par catégorie. Voir 0021.
  portion_label text,
  portion_grams int,                   -- poids correspondant, pour les courses
  season jsonb,
  intro_order int,
  -- Allergène porté, en clé étrangère (posée plus bas : `allergens` n'existe pas
  -- encore ici). `allergen_type` ne sert plus qu'à l'affichage.
  allergen_id uuid,
  created_at timestamptz not null default now()
);

create table public.allergens (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households (id) on delete cascade,
  name text not null,
  type text,
  intro_window text,                   -- libellé lisible, dérivé des bornes ci-dessous
  note text,                           -- préparation et remarques de fond
  -- Consigne de sécurité seule — ce qui blesse si on l'ignore (étouffement,
  -- cru, métaux lourds). Même nom et même rendu que `foods.restrictions` : la
  -- page allergènes montre celle-ci, jamais `note`. Voir 0020.
  restrictions text,
  intro_order int,                     -- ordre d'introduction conseillé
  window_start_months numeric(4, 1),   -- ouverture de la fenêtre
  window_end_months numeric(4, 1),     -- borne haute : le générateur planifie à rebours
  evidence_level text check (evidence_level in ('rct', 'standard')),
  starting_dose text,                  -- dose du jour 1 (test)
  target_dose text,                    -- dose cible ≈ 2 g de protéine
  maintenance_per_week int not null default 2, -- 0 = pas d'entretien (soja)
  requires_medical_advice boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.foods
  add constraint foods_allergen_id_fkey
  foreign key (allergen_id) references public.allergens (id) on delete set null;

-- Unicité du nom dans le catalogue commun (household_id null) uniquement : un
-- foyer reste libre de nommer son aliment comme il veut. Ces index rendent aussi
-- le catalogue upsertable par nom, ce dont les migrations se servent.
create unique index if not exists foods_common_name_key
  on public.foods (name)
  where household_id is null;

create unique index if not exists allergens_common_name_key
  on public.allergens (name)
  where household_id is null;

create table public.meal_moments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label text not null,
  -- Ordre d'affichage, DÉRIVÉ de start_minute (cf. 0022) : jamais écrit seul.
  position int not null default 0,
  -- Le créneau, en minutes depuis minuit local. Borne haute EXCLUE : 18 h 00
  -- appartient au dîner qui commence, pas au goûter qui finit.
  start_minute int not null,
  end_minute   int not null,
  created_at timestamptz not null default now(),
  constraint meal_moments_window check (
    start_minute >= 0 and end_minute <= 1440 and start_minute < end_minute
  ),
  -- Deux moments d'un même foyer ne se chevauchent jamais. C'est cet invariant
  -- qui permet à `currentMoment()` de renvoyer UN moment et non une liste.
  constraint meal_moments_no_overlap exclude using gist (
    household_id with =,
    int4range(start_minute, end_minute) with &&
  )
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  baby_id uuid not null references public.babies (id) on delete cascade,
  date date not null,
  meal_moment_id uuid references public.meal_moments (id) on delete set null,
  result text check (result in ('bien', 'moyen', 'refuse')),
  note text,
  -- Ce qui s'est réellement passé (cf. 0017) : le programme écrit 'prevu', le
  -- parent écrit le reste, le moteur de replanification lit la différence.
  status text not null default 'prevu'
    check (status in ('prevu', 'servi', 'remplace', 'saute')),
  logged_at timestamptz,               -- horodatage du signal du parent
  locked boolean not null default false, -- repas fixé par le parent, jamais réécrit
  planned_food_ids uuid[],             -- ce qui était prévu, avant correction
  created_at timestamptz not null default now()
);

-- Le rattrapage cherche les repas passés restés sans signal, par enfant.
create index meals_baby_status_date_idx on public.meals (baby_id, status, date);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete cascade,
  -- Dose prescrite (allergènes) : « une pointe de cuillère », puis « 2 c. à café ».
  dose text,
  source text not null default 'programme'
    check (source in ('programme', 'parent')),
  -- « La purée oui, la cuillère d'œuf non » — confirmation d'exposition fine,
  -- exigée par le protocole allergènes (cf. 0017).
  skipped boolean not null default false
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
  -- Deux trous assumés — [10 h, 11 h[ et [14 h, 15 h[ — et une jointure franche
  -- entre goûter et dîner : un jeu qui couvrirait la journée entière masquerait
  -- le cas « on est entre deux repas » au lieu de le régler.
  insert into public.meal_moments (household_id, label, position, start_minute, end_minute) values
    (new_household_id, 'Petit-déjeuner', 0,  6*60, 10*60),
    (new_household_id, 'Déjeuner',       1, 11*60, 14*60),
    (new_household_id, 'Goûter',         2, 15*60, 18*60),
    (new_household_id, 'Dîner',          3, 18*60, 22*60);
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
  ('Chou', 'légume', 6, false, null, 'Cuit, mixé', 'Peut être plus fort en goût : introduire progressivement.', null, null),
  ('Navet', 'légume', 6, false, null, 'Cuit, mixé', 'Vapeur puis mixer.', null, null),
  ('Fenouil', 'légume', 6, false, null, 'Cuit, mixé', 'Vapeur puis mixer.', null, null),
  -- Avocat : botaniquement un fruit, rangé en légume parce que la catégorie
  -- pilote le créneau de repas (slotCats) — il se sert écrasé dans une purée
  -- salée, pas en dessert.
  ('Avocat', 'légume', 4, false, null, 'Cru, écrasé', 'Bien mûr, cru, écrasé à la fourchette et délayé si besoin. Aucune cuisson. Riche en bons lipides.', null, null),
  -- Les plus achetés en France, absents jusqu'en 0020. Le poivron à 8 mois : les
  -- sources divergent (4-6 mois pelé chez les uns, 8 chez les autres) et son
  -- `intro_order` le place de toute façon en fin de liste.
  ('Tomate', 'légume', 6, false, null, 'Cuite, pelée, mixée', 'Mondée, épépinée, cuite puis mixée. L''acidité s''adoucit à la cuisson : elle passe mieux mélangée à une pomme de terre ou à une courgette.', null, null),
  ('Betterave', 'légume', 6, false, null, 'Cuite, mixée', 'La betterave cuite sous vide convient parfaitement : pelée, puis mixée. Douce et sucrée, c''est l''un des légumes les mieux acceptés.', 'Riche en nitrates : quelques cuillères à la fois, et pas tous les jours avant 1 an.', null),
  ('Aubergine', 'légume', 6, false, null, 'Cuite, pelée, mixée', 'Pelée et débarrassée de ses grosses graines — ni la peau ni les graines ne se digèrent — puis cuite et mixée.', null, null),
  ('Poivron', 'légume', 8, false, null, 'Cuit, pelé, mixé', 'Pelé à l''économe, épépiné, cuit puis mixé. Goût marqué : à servir mélangé, jamais seul.', null, null),
  ('Pomme', 'fruit', 4, false, null, 'Cuite, mixée', 'Compote sans sucre. Crue râpée plus tard.', null, null),
  ('Poire', 'fruit', 4, false, null, 'Cuite, mixée', 'Compote sans sucre.', null, null),
  ('Banane', 'fruit', 4, false, null, 'Écrasée', 'Bien mûre, écrasée à la fourchette.', null, null),
  ('Mangue', 'fruit', 4, false, null, 'Bien mûre, écrasée', 'Bien mûre, pelée, écrasée à la fourchette. Sans sucre. Aucune cuisson.', null, null),
  ('Abricot', 'fruit', 4, false, null, 'Cuit, mixé', 'Compote sans sucre.', null, null),
  ('Pêche', 'fruit', 4, false, null, 'Cuite, mixée', 'Compote sans sucre.', null, null),
  ('Fraise', 'fruit', 4, false, null, 'Écrasée', 'Sans sucre. Couper si morceaux.', null, null),
  ('Myrtille', 'fruit', 4, false, null, 'Écrasée, mixée', 'Sans sucre.', null, null),
  ('Melon', 'fruit', 4, false, null, 'Cru bien mûr, mixé', 'Bien mûr, épépiné, mixé cru. Sans sucre.', null, null),
  ('Raisin', 'fruit', 4, false, null, 'Mixé et passé', 'Sans pépins, lavé, mixé puis passé pour retirer les peaux. Sans sucre.', 'Jamais de grain entier avant 4 ans (fausse route) : mixé, ou coupé en quatre dans la longueur pour les plus grands.', null),
  -- Le pruneau n'est pas un fruit de découverte : on y vient pour le transit.
  -- C'est aussi le seul aliment du catalogue dont la portion ne se déduit pas de
  -- la catégorie — cf. `portion_label` en §11.
  ('Pruneau', 'fruit', 4, false, null, 'Réhydraté, mixé', 'Dénoyauté, réhydraté à l''eau chaude puis mixé. À mélanger à un autre fruit — seul, il est très concentré. Naturellement riche en fibres, il aide le transit.', 'Jamais entier avant 4 ans (fausse route). Riche en fibres et en sucres : 1 à 2 pruneaux suffisent, 3 au plus si le transit est bloqué, une fois par jour.', '1 pruneau pour une pomme ; jusqu''à 3 en cas de constipation'),
  ('Poulet', 'protéine', 4, false, null, 'Cuit, mixé', 'Cuire sans matière grasse, mixer avec des légumes. Bien cuit.', null, '10 g/jour par année d''âge (2 c. à café)'),
  ('Bœuf', 'protéine', 4, false, null, 'Cuit, mixé', 'Riche en fer. Bien cuit, mixé finement.', null, '10 g/jour par année d''âge'),
  ('Jambon blanc', 'protéine', 4, false, null, 'Mixé', 'Découenné, dégraissé, mixé. Reste salé.', null, '10 g/jour par année d''âge'),
  ('Poisson blanc', 'protéine', 4, true, 'poisson', 'Cuit, émietté', 'Maigre (colin, cabillaud, merlan). Vapeur, sans arêtes. Non pané.', 'Limiter thon, espadon (métaux lourds).', '10 g/jour par année d''âge, 1×/sem'),
  ('Poisson gras (sardine, maquereau)', 'protéine', 4, true, 'poisson', 'Cuit, émietté', 'Riche en oméga-3. Bien cuit, sans arêtes.', 'Poisson gras 1×/semaine. Éviter gros prédateurs.', '10 g/jour par année d''âge'),
  ('Œuf dur', 'protéine', 4, true, 'œuf', 'Écrasé', 'Jaune + blanc, bien cuit (dur). ¼ d''œuf ≈ 10 g de viande.', 'Jamais cru ou peu cuit avant 5 ans.', 'commencer petit'),
  ('Petit-suisse', 'laitier', 5, true, 'lait de vache', 'Lisse', 'Préférer les laitages bébé (lait 2e âge).', null, null),
  ('Yaourt bébé', 'laitier', 6, true, 'lait de vache', 'Lisse', 'Préférer les laitages bébé.', null, null),
  ('Fromage blanc', 'laitier', 6, true, 'lait de vache', 'Lisse', 'Préférer les laitages bébé.', null, null),
  ('Fromage à pâte pressée', 'laitier', 9, true, 'lait de vache', 'Râpé/petits morceaux', 'Vers 9 mois (gruyère, comté). Cuit à cœur.', 'Fromages au lait cru exclus avant 5 ans (sauf pâtes pressées cuites).', null),
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
  -- Vecteurs d'allergènes : sans eux, 9 des 16 allergènes n'ont aucun support
  -- et ne peuvent pas être planifiés (cf. 0016).
  ('Purée de noisette', 'autre', 5, true, 'noisette', 'Purée lisse délayée', 'Délayer dans une compote ou une purée de légumes. Sans sucre ni sel ajouté.', 'Jamais de fruit à coque entier avant 3 ans (fausse route).', '2 c. à café'),
  ('Purée d''amande', 'autre', 5, true, 'amande', 'Purée lisse délayée', 'Délayer dans une compote ou une purée de légumes. Sans sucre ni sel ajouté.', 'Jamais de fruit à coque entier avant 3 ans (fausse route).', '2 c. à café'),
  ('Purée de sésame (tahini)', 'autre', 5, true, 'sésame', 'Purée lisse délayée', 'Délayer dans une compote ou une purée de légumes. Sans sucre ni sel ajouté.', null, '2 c. à café'),
  ('Purée de noix de cajou', 'autre', 6, true, 'noix de cajou', 'Purée lisse délayée', 'Délayer dans une compote ou une purée de légumes.', 'Jamais de fruit à coque entier avant 3 ans (fausse route).', '2 c. à café'),
  ('Purée de pistache', 'autre', 6, true, 'pistache', 'Purée lisse délayée', 'Délayer dans une compote ou une purée de légumes.', 'Jamais de fruit à coque entier avant 3 ans (fausse route).', '2 c. à café'),
  ('Purée de noix', 'autre', 6, true, 'noix', 'Purée lisse délayée', 'Délayer dans une compote ou une purée de légumes.', 'Jamais de fruit à coque entier avant 3 ans (fausse route).', '2 c. à café'),
  ('Moutarde', 'autre', 6, true, 'moutarde', 'Une pointe', 'Une pointe de couteau dans un plat salé, pour l''allergène — pas pour le goût.', null, 'une pointe de couteau'),
  ('Tofu soyeux', 'autre', 6, true, 'soja', 'Lisse', 'Une pointe de cuillère mélangée à une purée.', 'Soja déconseillé comme aliment avant 3 ans (phyto-œstrogènes) : trace seulement.', 'trace'),
  ('Farine infantile avec gluten', 'autre', 6, true, 'gluten', 'Délayée', 'Délayer 1 c. à café dans un biberon, puis 2 c. à café vers 7 mois.', null, '1 à 2 c. à café'),
  ('Crevette', 'protéine', 8, true, 'fruits de mer', 'Cuite, mixée', 'Bien cuite, décortiquée, mixée finement.', 'Provenance d''une zone d''élevage autorisée.', '10 g'),
  ('Sarrasin', 'féculent', 8, true, 'sarrasin', 'Bien cuit, mixé', 'Cuire comme une semoule, mixer.', null, '2 c. à café'),
  ('Kiwi', 'fruit', 8, true, 'kiwi', 'Bien mûr, écrasé', 'Bien mûr, pelé, écrasé à la fourchette. Sans sucre.', null, '½ kiwi'),
  ('Framboise', 'fruit', 4, false, null, 'Écrasée, mixée', 'Sans sucre. Passer pour retirer les grains si besoin.', null, null),
  ('Miel', 'autre', 12, false, null, null, 'À réserver après 12 mois.', 'Interdit avant 12 mois (botulisme).', null);

-- Allergènes — 16 entrées ordonnées par force de la preuve, puis par fréquence
-- chez l'enfant en France (séries CICBAA). Fenêtres, doses et entretien sont
-- lus par le générateur : voir src/lib/program/allergens.ts.
insert into public.allergens
  (name, type, intro_order, window_start_months, window_end_months,
   evidence_level, starting_dose, target_dose, maintenance_per_week,
   requires_medical_advice, intro_window, note)
values
  -- Preuve d'essai randomisé (LEAP, PETIT/STAR) : fenêtre 4-6 mois, priorité absolue.
  ('Arachide', 'oléagineux', 1, 4, 6, 'rct',
   'Une pointe de cuillère de beurre de cacahuète délayé',
   '2 c. à café de beurre de cacahuète (≈ 2 g de protéine)', 2, true,
   'dès 4-6 mois',
   'Délayé dans une compote ou un laitage. Jamais de cacahuète entière avant 3 ans.'),
  ('Œuf', 'protéine', 2, 4, 6, 'rct',
   'Une pointe de cuillère de jaune d''œuf dur',
   '⅓ d''œuf dur (≈ 2 g de protéine)', 2, false,
   'dès 4-6 mois',
   'Toujours bien cuit (dur). Jamais cru ou peu cuit avant 5 ans.'),
  ('Lait de vache', 'protéine', 3, 4, 6, 'rct',
   'Une cuillère à café de laitage bébé nature',
   '50 g de laitage bébé (≈ 2 g de protéine)', 2, false,
   'dès 4-6 mois',
   'Via les laitages bébé. Le lait de vache en boisson attend 12 mois.'),

  -- Fenêtre large, preuve observationnelle (EAT) : à faire dans la foulée.
  ('Gluten', 'céréale', 4, 6, 8, 'standard',
   '1 c. à café de farine infantile avec gluten',
   '2 c. à café de farine, ou 50 g de semoule cuite', 2, false,
   'dès 6 mois',
   'Progressivement, dans un biberon puis dans les repas.'),
  ('Poisson', 'protéine', 5, 5.5, 8, 'standard',
   'Une pointe de cuillère de poisson blanc cuit',
   '10 g de poisson (≈ 2 g de protéine)', 2, false,
   'dès 5-6 mois',
   'Cuit, sans arêtes, non pané. Limiter les gros prédateurs (métaux lourds).'),
  ('Sésame', 'graine', 6, 5, 8, 'standard',
   'Une pointe de cuillère de purée de sésame',
   '2 c. à café de purée de sésame', 2, false,
   'dès 5-6 mois',
   'En purée (tahini), délayée dans une compote ou une purée de légumes.'),

  -- Fruits à coque, éclatés : la réactivité croisée n'est pas uniforme
  -- (noisette/amande/noix d'un côté, cajou/pistache de l'autre).
  ('Noisette', 'oléagineux', 7, 5, 8, 'standard',
   'Une pointe de cuillère de purée de noisette',
   '2 c. à café de purée de noisette', 2, false,
   'dès 5-6 mois',
   'En purée uniquement. Jamais de fruit à coque entier avant 3 ans.'),
  ('Amande', 'oléagineux', 8, 5, 8, 'standard',
   'Une pointe de cuillère de purée d''amande',
   '2 c. à café de purée d''amande', 2, false,
   'dès 5-6 mois',
   'En purée uniquement. Jamais de fruit à coque entier avant 3 ans.'),
  ('Noix de cajou', 'oléagineux', 9, 6, 9, 'standard',
   'Une pointe de cuillère de purée de cajou',
   '2 c. à café de purée de cajou', 2, false,
   'dès 6 mois',
   'Groupe distinct de la noisette : tolérer l''une ne présage pas de l''autre.'),
  ('Pistache', 'oléagineux', 10, 6, 9, 'standard',
   'Une pointe de cuillère de purée de pistache',
   '2 c. à café de purée de pistache', 2, false,
   'dès 6 mois',
   'Proche de la noix de cajou. En purée uniquement.'),
  ('Noix', 'oléagineux', 11, 6, 9, 'standard',
   'Une pointe de cuillère de purée de noix',
   '2 c. à café de purée de noix', 2, false,
   'dès 6 mois',
   'En purée uniquement. Jamais de fruit à coque entier avant 3 ans.'),

  -- Fréquents chez l'enfant en France (séries CICBAA), absents des listes
  -- anglo-saxonnes — d'où leur présence ici.
  ('Moutarde', 'condiment', 12, 6, 10, 'standard',
   'Une pointe de couteau dans un plat salé',
   'Une pointe de couteau, 2 fois par semaine', 2, false,
   'dès 6 mois',
   'Un des allergènes les plus fréquents chez l''enfant en France.'),
  ('Soja', 'légumineuse', 13, 6, 10, 'standard',
   'Une pointe de cuillère de tofu soyeux',
   'Trace uniquement — pas de consommation régulière', 0, false,
   'dès 6 mois',
   'Introduit comme allergène, mais le soja aliment est déconseillé avant 3 ans '
   '(phyto-œstrogènes) : pas d''entretien à dose.'),
  ('Fruits de mer', 'protéine', 14, 8, 12, 'standard',
   'Une pointe de cuillère de crevette cuite mixée',
   '10 g de crevette cuite', 2, false,
   'dès 8 mois',
   'Bien cuits, d''une zone d''élevage autorisée.'),
  ('Sarrasin', 'céréale', 15, 8, 12, 'standard',
   '1 c. à café de sarrasin cuit',
   '2 c. à café de sarrasin cuit', 2, false,
   'dès 8 mois',
   'Sans gluten, mais allergène à part entière — fréquent en France (galettes).'),
  ('Kiwi', 'fruit', 16, 8, 12, 'standard',
   '1 c. à café de kiwi bien mûr écrasé',
   '½ kiwi bien mûr', 2, false,
   'dès 8 mois',
   'Bien mûr et écrasé. Fréquent chez l''enfant en France.');

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
update public.foods set season = '[[6,10]]'        where name = 'Framboise' and household_id is null;
update public.foods set season = '[[11,12],[1,3]]' where name = 'Kiwi' and household_id is null;
update public.foods set season = '[[6,9]]'         where name = 'Melon' and household_id is null;
update public.foods set season = '[[9,10]]'        where name = 'Raisin' and household_id is null;
update public.foods set season = '[[6,9]]'         where name = 'Tomate' and household_id is null;
update public.foods set season = '[[7,9]]'         where name = 'Aubergine' and household_id is null;
update public.foods set season = '[[7,10]]'        where name = 'Poivron' and household_id is null;
-- Mangue et avocat n'ont pas de saison française : null, comme la banane.
-- Betterave et pruneau restent à null pour deux raisons différentes. La
-- betterave a bien une saison au champ, mais celle qu'on achète est cuite sous
-- vide et se trouve toute l'année : `freshnessAdvice` ne sait dire que « frais »
-- ou « surgelé », et conseiller du surgelé en avril serait faux. Le pruneau est
-- un fruit sec — la question ne se pose pas.

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
-- L'intervalle 11-20 séparait les dix légumes du guide des légumes à goût fort :
-- les deux légumes doux de 0020 s'y installent.
update public.foods set intro_order = 11 where name = 'Betterave' and household_id is null;
update public.foods set intro_order = 12 where name = 'Tomate' and household_id is null;
update public.foods set intro_order = 21 where name = 'Chou' and household_id is null;
update public.foods set intro_order = 22 where name = 'Navet' and household_id is null;
update public.foods set intro_order = 23 where name = 'Fenouil' and household_id is null;
update public.foods set intro_order = 24 where name = 'Avocat' and household_id is null;
update public.foods set intro_order = 25 where name = 'Aubergine' and household_id is null;
update public.foods set intro_order = 26 where name = 'Poivron' and household_id is null;
update public.foods set intro_order = 1  where name = 'Pomme' and household_id is null;
update public.foods set intro_order = 2  where name = 'Poire' and household_id is null;
update public.foods set intro_order = 3  where name = 'Banane' and household_id is null;
-- La mangue arrive tôt : fruit doux, sans acidité ni pépins, aucune cuisson.
update public.foods set intro_order = 4  where name = 'Mangue' and household_id is null;
update public.foods set intro_order = 5  where name = 'Abricot' and household_id is null;
update public.foods set intro_order = 6  where name = 'Pêche' and household_id is null;
update public.foods set intro_order = 7  where name = 'Fraise' and household_id is null;
update public.foods set intro_order = 8  where name = 'Myrtille' and household_id is null;
update public.foods set intro_order = 9  where name = 'Framboise' and household_id is null;
update public.foods set intro_order = 10 where name = 'Kiwi' and household_id is null;
update public.foods set intro_order = 11 where name = 'Melon' and household_id is null;
update public.foods set intro_order = 12 where name = 'Raisin' and household_id is null;
-- Le pruneau ferme la liste : on y vient pour une raison précise, pas au fil de
-- la découverte des goûts.
update public.foods set intro_order = 13 where name = 'Pruneau' and household_id is null;
-- Aliments allergènes : sans ordre explicite, le tri du générateur se rabattait
-- sur une comparaison d'UUID — donc sur un ordre arbitraire et non reproductible.
update public.foods set intro_order = 100 where name = 'Beurre de cacahuète' and household_id is null;
update public.foods set intro_order = 101 where name = 'Purée de noisette' and household_id is null;
update public.foods set intro_order = 102 where name = 'Purée d''amande' and household_id is null;
update public.foods set intro_order = 103 where name = 'Purée de sésame (tahini)' and household_id is null;
update public.foods set intro_order = 104 where name = 'Purée de noix de cajou' and household_id is null;
update public.foods set intro_order = 105 where name = 'Purée de pistache' and household_id is null;
update public.foods set intro_order = 106 where name = 'Purée de noix' and household_id is null;
update public.foods set intro_order = 107 where name = 'Moutarde' and household_id is null;
update public.foods set intro_order = 108 where name = 'Tofu soyeux' and household_id is null;
update public.foods set intro_order = 109 where name = 'Farine infantile avec gluten' and household_id is null;
update public.foods set intro_order = 110 where name = 'Crevette' and household_id is null;
update public.foods set intro_order = 111 where name = 'Sarrasin' and household_id is null;
update public.foods set intro_order = 112 where name = 'Œuf dur' and household_id is null;
update public.foods set intro_order = 113 where name = 'Poisson blanc' and household_id is null;
update public.foods set intro_order = 114 where name = 'Poisson gras (sardine, maquereau)' and household_id is null;

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
update public.foods set cook_minutes = 0,  prep_note = 'Choisis-le souple sous le pouce, dénoyaute et prélève la chair à la cuillère' where household_id is null and name = 'Avocat';
update public.foods set cook_minutes = 8,  prep_note = 'Ébouillante-la 30 s pour la peler, épépine-la et coupe-la en quartiers' where household_id is null and name = 'Tomate';
-- La betterave arrive déjà cuite : son geste se suffit à lui-même, comme celui
-- du jambon blanc.
update public.foods set cook_minutes = 0,  prep_note = 'Prends-la cuite sous vide, pèle-la et coupe-la en dés — elle est déjà cuite' where household_id is null and name = 'Betterave';
update public.foods set cook_minutes = 20, prep_note = 'Épluche-la, retire les grosses graines et coupe la chair en dés' where household_id is null and name = 'Aubergine';
update public.foods set cook_minutes = 10, prep_note = 'Pèle-le à l''économe, retire les graines et les côtes blanches, coupe en lanières' where household_id is null and name = 'Poivron';
-- Fruits
update public.foods set cook_minutes = 10, prep_note = 'Épluche, retire le cœur et coupe en morceaux' where household_id is null and name = 'Pomme';
update public.foods set cook_minutes = 8,  prep_note = 'Épluche, retire le cœur et coupe en morceaux' where household_id is null and name = 'Poire';
update public.foods set cook_minutes = 0,  prep_note = 'Choisis-la bien mûre et écrase-la à la fourchette' where household_id is null and name = 'Banane';
update public.foods set cook_minutes = 0,  prep_note = 'Choisis-la bien mûre, pèle-la et détache la chair du noyau' where household_id is null and name = 'Mangue';
update public.foods set cook_minutes = 8,  prep_note = 'Dénoyaute et coupe en quartiers' where household_id is null and name = 'Abricot';
update public.foods set cook_minutes = 8,  prep_note = 'Épluche, dénoyaute et coupe en quartiers' where household_id is null and name = 'Pêche';
update public.foods set cook_minutes = 0,  prep_note = 'Équeute, lave et mixe crue (bien mûre)' where household_id is null and name = 'Fraise';
update public.foods set cook_minutes = 5,  prep_note = 'Rince (une cuisson courte facilite le mixage)' where household_id is null and name = 'Myrtille';
update public.foods set cook_minutes = 0,  prep_note = 'Épépine, retire l''écorce et coupe la chair en cubes' where household_id is null and name = 'Melon';
update public.foods set cook_minutes = 0,  prep_note = 'Lave, égrappe, mixe et passe pour retirer les peaux' where household_id is null and name = 'Raisin';
update public.foods set cook_minutes = 0,  prep_note = 'Vérifie qu''ils sont bien dénoyautés et fais-les tremper 10 min dans l''eau chaude' where household_id is null and name = 'Pruneau';
-- Protéines
update public.foods set cook_minutes = 15, prep_note = 'Retire la peau et le gras, coupe en dés' where household_id is null and name = 'Poulet';
update public.foods set cook_minutes = 15, prep_note = 'Coupe en petits dés, sans gras' where household_id is null and name = 'Bœuf';
update public.foods set cook_minutes = 0,  prep_note = 'Découenne-le et retire le gras — il est déjà cuit' where household_id is null and name = 'Jambon blanc';
update public.foods set cook_minutes = 10, prep_note = 'Vérifie l''absence d''arêtes, coupe en morceaux' where household_id is null and name = 'Poisson blanc';
update public.foods set cook_minutes = 10, prep_note = 'Vérifie l''absence d''arêtes, coupe en morceaux' where household_id is null and name = 'Poisson gras (sardine, maquereau)';
update public.foods set cook_minutes = 10, prep_note = 'Cuis-le dur à part, 10 min à l''eau bouillante, puis écale-le — jaune et blanc' where household_id is null and name = 'Œuf dur';
-- Féculents
update public.foods set cook_minutes = 5,  prep_note = 'Verse-la en pluie dans un volume égal d''eau chaude et laisse-la gonfler 5 min, à part' where household_id is null and name = 'Semoule';
update public.foods set cook_minutes = 20, prep_note = 'Rince-le, puis cuis-le à part 20 min dans un grand volume d''eau, bien tendre' where household_id is null and name = 'Riz';
update public.foods set cook_minutes = 10, prep_note = 'Choisis de petites formes et cuis-les à part 10 min à l''eau, bien tendres' where household_id is null and name = 'Pâtes';
update public.foods set cook_minutes = 20, prep_note = 'Épluche et coupe en cubes' where household_id is null and name = 'Pomme de terre';
update public.foods set cook_minutes = 20, prep_note = 'Épluche et coupe en cubes' where household_id is null and name = 'Patate douce';
update public.foods set cook_minutes = 25, prep_note = 'Rince-les, puis cuis-les à part 25 min à l''eau, bien tendres' where household_id is null and name = 'Lentilles';
update public.foods set cook_minutes = 10, prep_note = 'En conserve : rince-les, retire les peaux et réchauffe-les à part 10 min à l''eau' where household_id is null and name = 'Pois chiches';
update public.foods set cook_minutes = 0,  prep_note = 'Donne la croûte ou un morceau de mie, sous surveillance' where household_id is null and name = 'Pain';
-- Laitiers, matières grasses, divers (aucune cuisson)
update public.foods set cook_minutes = 0, prep_note = 'Sers-le nature, sans sucre ajouté' where household_id is null and name in ('Petit-suisse', 'Yaourt bébé', 'Fromage blanc');
update public.foods set cook_minutes = 0, prep_note = 'Râpe finement (pâte pressée cuite uniquement)' where household_id is null and name = 'Fromage à pâte pressée';
update public.foods set cook_minutes = 0, prep_note = 'Ajoute-la crue, hors cuisson, juste avant de servir' where household_id is null and name in ('Huile de colza', 'Huile de noix');
update public.foods set cook_minutes = 0, prep_note = 'Ajoute-le hors cuisson, juste avant de servir' where household_id is null and name = 'Beurre';
update public.foods set cook_minutes = 0, prep_note = 'Délaie une pointe' where household_id is null and name = 'Beurre de cacahuète';
update public.foods set cook_minutes = 0, prep_note = 'Délaie une pointe' where household_id is null and name in ('Purée de noisette', 'Purée d''amande', 'Purée de noix de cajou', 'Purée de pistache', 'Purée de noix');
update public.foods set cook_minutes = 0, prep_note = 'Délaie une pointe' where household_id is null and name = 'Purée de sésame (tahini)';
update public.foods set cook_minutes = 0, prep_note = 'Mélange une pointe de couteau' where household_id is null and name = 'Moutarde';
update public.foods set cook_minutes = 0, prep_note = 'Écrase une pointe' where household_id is null and name = 'Tofu soyeux';
update public.foods set cook_minutes = 0, prep_note = 'Délaie 1 c. à café dans un biberon' where household_id is null and name = 'Farine infantile avec gluten';
update public.foods set cook_minutes = 5,  prep_note = 'Décortique entièrement et retire le boyau' where household_id is null and name = 'Crevette';
update public.foods set cook_minutes = 12, prep_note = 'Rince-le, puis cuis-le à part 12 min à l''eau, bien tendre' where household_id is null and name = 'Sarrasin';
update public.foods set cook_minutes = 0,  prep_note = 'Pèle-le bien mûr et écrase-le à la fourchette' where household_id is null and name = 'Kiwi';
update public.foods set cook_minutes = 0,  prep_note = 'Écrase-la et passe-la pour retirer les grains' where household_id is null and name = 'Framboise';
update public.foods set cook_minutes = 0, prep_note = 'Interdit avant 12 mois (botulisme)' where household_id is null and name = 'Miel';

-- Cuisson, préparation d'accueil, service à part — voir 0019.
-- Un repas n'est pas une assiette : la purée salée et la compote sont deux
-- préparations distinctes, et tout ne cuit pas à la vapeur. Ces trois colonnes
-- sont ce que le pas-à-pas (src/lib/recipe.ts) ne peut pas déduire de la
-- catégorie — un féculent cuit tantôt à la vapeur (pomme de terre) tantôt à
-- l'eau (riz), un laitier se sert nature quand un fruit se mixe.
update public.foods set
  cook_method = case when coalesce(cook_minutes, 0) > 0 then 'vapeur' else 'aucune' end,
  course = case
    when category = 'fruit' then 'sucré'
    when category in ('légume', 'protéine', 'féculent', 'matière grasse') then 'salé'
    else null
  end,
  served_apart = (category = 'laitier');

-- Les cuissons à l'eau : à part, dans leur casserole. Leur `prep_note` porte
-- déjà la cuisson entière — le pas-à-pas n'en ajoute pas une seconde.
update public.foods set cook_method = 'eau' where household_id is null
  and name in ('Œuf dur', 'Riz', 'Pâtes', 'Semoule', 'Lentilles', 'Pois chiches', 'Sarrasin');

-- Les deux doses qui n'ont de sens que dans un plat salé. Les autres additifs
-- gardent `course` NULL : ils se délaient dans la compote quand il y en a une,
-- le sucré masquant l'amertume mieux qu'une purée de légumes.
update public.foods set course = 'salé' where household_id is null
  and name in ('Moutarde', 'Tofu soyeux');

-- Le pain se mâchouille en croûte, la farine va dans un biberon, le miel
-- n'entre nulle part avant 12 mois : rien de tout cela ne se mixe.
update public.foods set served_apart = true where household_id is null
  and name in ('Pain', 'Farine infantile avec gluten', 'Miel');

-- Portion propre à l'aliment — voir 0021. Un seul aliment en a besoin
-- aujourd'hui : le pruneau, dessert dont la quantité n'a rien à voir avec celle
-- d'une compote. Vingt grammes ≈ deux pruneaux dénoyautés, ce que la liste de
-- courses agrège pendant que la fiche du repas affiche « 1 à 2 pruneaux ».
update public.foods set portion_label = '1 à 2 pruneaux', portion_grams = 20
  where household_id is null and name = 'Pruneau';

-- ----------------------------------------------------------------------------
-- 10. Lien aliment → allergène — voir 0016
-- ----------------------------------------------------------------------------
-- Résolu après coup : la clé étrangère ne peut être posée qu'une fois les deux
-- catalogues insérés. `allergen_type` ne sert plus qu'à l'affichage.
update public.foods f
   set allergen_id = a.id
  from public.allergens a
 where f.allergen_type is not null
   and a.household_id is null
   and lower(a.name) = lower(f.allergen_type);

-- ----------------------------------------------------------------------------
-- 11. Consignes de sécurité des allergènes — voir 0020
-- ----------------------------------------------------------------------------
-- Extraites de `note`, qui mêlait la recette (« délayé dans une compote ») et
-- l'interdiction (« jamais entière avant 3 ans ») dans la même phrase grise.
-- Seul ce qui blesse si on l'ignore est repris ici ; les allergènes sans danger
-- propre restent à NULL, une alerte partout ne se lisant plus nulle part.
update public.allergens set restrictions = case name
  when 'Arachide'      then 'Jamais de cacahuète entière ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Noisette'      then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Amande'        then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Noix de cajou' then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Pistache'      then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Noix'          then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Œuf'           then 'Jamais cru ni peu cuit avant 5 ans : risque de salmonelle.'
  when 'Fruits de mer' then 'Toujours bien cuits, jamais crus, d''une zone d''élevage autorisée.'
  when 'Poisson'       then 'Sans arêtes. Limiter les gros prédateurs — thon, espadon, requin (métaux lourds).'
  when 'Lait de vache' then 'Le lait de vache en boisson attend 12 mois : avant, laitages bébé uniquement.'
  when 'Soja'          then 'Le soja comme aliment est déconseillé avant 3 ans (phyto-œstrogènes) : une trace suffit.'
  else null
end
where household_id is null;
