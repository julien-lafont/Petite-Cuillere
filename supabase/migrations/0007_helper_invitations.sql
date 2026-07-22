-- ============================================================================
-- Baby Food Tracker — Invitations d'aidants & responsable de foyer
-- ============================================================================
-- Ajoute la possibilité d'inviter un aidant via un lien magique, et introduit
-- la notion de « responsable » (le premier inscrit du foyer) qui seul peut
-- inviter, voir les liens d'invitation et retirer des aidants.
--
-- À exécuter dans Supabase : SQL Editor → coller ce fichier → Run.
-- Idempotent (ré-exécutable sans erreur).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Colonnes ajoutées
-- ----------------------------------------------------------------------------

-- Nom d'affichage de l'aidant (renseigné par l'inviteur, sinon par la personne).
alter table public.profiles
  add column if not exists prenom text;

-- Responsable du foyer = premier inscrit. Peut inviter / retirer des aidants.
alter table public.households
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;

-- Rattrapage : le responsable est le profil le plus ancien de chaque foyer.
update public.households h
set owner_id = p.id
from (
  select distinct on (household_id) household_id, id
  from public.profiles
  order by household_id, created_at asc
) p
where p.household_id = h.id
  and h.owner_id is null;

-- ----------------------------------------------------------------------------
-- 2. Table des invitations
-- ----------------------------------------------------------------------------
-- Une invitation est créée par le responsable AVANT que la personne n'ait un
-- compte : il saisit son prénom + sa relation. Le `token` sert de lien magique.
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  prenom text not null,
  relation text,
  token uuid not null default gen_random_uuid() unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,                 -- null = en attente (tag « Invité·e »)
  accepted_by uuid references public.profiles (id) on delete set null
);

alter table public.invitations enable row level security;

-- ----------------------------------------------------------------------------
-- 3. Fonction : le foyer courant a-t-il l'utilisateur pour responsable ?
-- ----------------------------------------------------------------------------
create or replace function public.is_household_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.households h
    where h.id = public.current_household_id()
      and h.owner_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. RLS des invitations
-- ----------------------------------------------------------------------------
-- Tous les membres du foyer VOIENT les invitations en attente (pour le tag),
-- mais la colonne `token` est masquée au niveau des privilèges (voir §5) :
-- seul le responsable peut la lire, via la fonction dédiée. Seul le responsable
-- crée et supprime des invitations.
drop policy if exists "invitations in household" on public.invitations;
create policy "invitations in household" on public.invitations
  for select using (household_id = public.current_household_id());

drop policy if exists "owner inserts invitations" on public.invitations;
create policy "owner inserts invitations" on public.invitations
  for insert with check (
    household_id = public.current_household_id() and public.is_household_owner()
  );

drop policy if exists "owner deletes invitations" on public.invitations;
create policy "owner deletes invitations" on public.invitations
  for delete using (
    household_id = public.current_household_id() and public.is_household_owner()
  );

-- ----------------------------------------------------------------------------
-- 5. Protection de la colonne `token` (privilèges au niveau colonne)
-- ----------------------------------------------------------------------------
-- Personne ne lit `token` via l'API : il n'est accessible qu'au responsable,
-- au travers de la fonction SECURITY DEFINER `get_invitation_token`.
revoke all on public.invitations from anon;
revoke select on public.invitations from authenticated;
grant select
  (id, household_id, prenom, relation, created_by, created_at, accepted_at, accepted_by)
  on public.invitations to authenticated;
grant insert, delete on public.invitations to authenticated;

-- ----------------------------------------------------------------------------
-- 6. Détails d'une invitation (page publique « rejoindre »)
-- ----------------------------------------------------------------------------
create or replace function public.invitation_details(invite_token uuid)
returns table (prenom text, relation text, household_name text, is_pending boolean)
language sql
stable
security definer
set search_path = public
as $$
  select i.prenom, i.relation, h.name, (i.accepted_at is null)
  from public.invitations i
  join public.households h on h.id = i.household_id
  where i.token = invite_token;
$$;
grant execute on function public.invitation_details(uuid) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 7. Lien d'invitation (réservé au responsable)
-- ----------------------------------------------------------------------------
create or replace function public.get_invitation_token(invitation_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select token from public.invitations
  where id = invitation_id
    and household_id = public.current_household_id()
    and public.is_household_owner();
$$;
grant execute on function public.get_invitation_token(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Accepter une invitation
-- ----------------------------------------------------------------------------
-- L'utilisateur connecté rejoint le foyer d'invitation. Son foyer auto-créé à
-- l'inscription (vide) est supprimé au passage.
create or replace function public.accept_invitation(invite_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.invitations;
  v_old_household uuid;
  v_old_profiles int;
  v_old_babies int;
begin
  if v_uid is null then
    raise exception 'non authentifié';
  end if;

  select * into v_inv
  from public.invitations
  where token = invite_token and accepted_at is null;
  if not found then
    raise exception 'invitation invalide ou déjà utilisée';
  end if;

  select household_id into v_old_household
  from public.profiles where id = v_uid;

  -- Déjà membre du foyer cible : on marque juste l'invitation comme acceptée.
  if v_old_household = v_inv.household_id then
    update public.invitations
      set accepted_at = now(), accepted_by = v_uid
      where id = v_inv.id;
    return;
  end if;

  -- Rattacher le profil au foyer d'invitation (prénom + relation choisis par
  -- l'inviteur font foi).
  update public.profiles
    set household_id = v_inv.household_id,
        prenom = v_inv.prenom,
        relation = v_inv.relation
    where id = v_uid;

  update public.invitations
    set accepted_at = now(), accepted_by = v_uid
    where id = v_inv.id;

  -- Supprimer l'ancien foyer s'il est resté vide (auto-créé, jamais utilisé).
  select count(*) into v_old_profiles
  from public.profiles where household_id = v_old_household;
  select count(*) into v_old_babies
  from public.babies where household_id = v_old_household;
  if v_old_profiles = 0 and v_old_babies = 0 then
    delete from public.households where id = v_old_household;
  end if;
end;
$$;
grant execute on function public.accept_invitation(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. Retirer un aidant (réservé au responsable)
-- ----------------------------------------------------------------------------
-- Révocation COMPLÈTE : le compte de l'aidant est supprimé de `auth.users`, ce
-- qui efface en cascade son profil (`profiles.id` → `auth.users` on delete
-- cascade). Il ne reste aucune trace de la personne dans la base. Les données du
-- foyer (repas, aliments…) sont rattachées au foyer, pas à la personne : elles
-- restent intactes.
create or replace function public.remove_helper(target_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household uuid := public.current_household_id();
  v_target_household uuid;
begin
  if not public.is_household_owner() then
    raise exception 'réservé au responsable du foyer';
  end if;
  if target_profile = auth.uid() then
    raise exception 'le responsable ne peut pas se retirer lui-même';
  end if;

  select household_id into v_target_household
  from public.profiles where id = target_profile;
  if v_target_household is null or v_target_household <> v_household then
    raise exception 'aidant introuvable dans ce foyer';
  end if;

  -- Supprime le compte : cascade sur profiles (et donc retrait du foyer).
  delete from auth.users where id = target_profile;
end;
$$;
grant execute on function public.remove_helper(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 10. Nouvel utilisateur → il est responsable de son propre foyer
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

  -- Le créateur du foyer en est le responsable.
  update public.households set owner_id = new.id where id = new_household_id;

  insert into public.meal_moments (household_id, label, position) values
    (new_household_id, 'Petit-déjeuner', 0),
    (new_household_id, 'Déjeuner', 1),
    (new_household_id, 'Goûter', 2),
    (new_household_id, 'Dîner', 3);

  return new;
end;
$$;
