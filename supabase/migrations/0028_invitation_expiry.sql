-- ============================================================================
-- Petite Cuillère — Les liens d'invitation expirent
-- ============================================================================
-- `accept_invitation()` ne vérifiait qu'une chose : que le lien n'ait pas déjà
-- servi. Un lien jamais utilisé ouvrait donc le foyer indéfiniment — un vieux fil
-- d'e-mails, un message transféré, une tablette de famille partagée, une
-- invitation que le responsable a oubliée. Le token est un UUIDv4 : il ne se
-- devine pas, c'est bien sa durée de vie qui est en cause.
--
-- Sept jours : le lien se transmet dans la foulée, à quelqu'un qu'on a au
-- téléphone. Passé ce délai, il vaut mieux le refaire que le retrouver.
--
-- Le rattrapage compte depuis la création, pas depuis aujourd'hui : les liens
-- déjà en circulation sont précisément ceux que cette migration ferme.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

alter table public.invitations
  add column if not exists expires_at timestamptz
    not null default now() + interval '7 days';

update public.invitations
  set expires_at = created_at + interval '7 days'
  where expires_at <> created_at + interval '7 days';

comment on column public.invitations.expires_at is
  'Fin de validité du lien. Passée cette date, `accept_invitation` refuse.';

-- La colonne suit le même régime que les autres : `token` reste hors de portée
-- de l'API (0007 §5), le reste est lisible par les membres du foyer.
grant select (expires_at) on public.invitations to authenticated;

-- ----------------------------------------------------------------------------
-- Les deux fonctions qui décident de la validité d'un lien
-- ----------------------------------------------------------------------------
-- `invitation_details` alimente la page publique : elle doit dire « périmé »
-- avant d'afficher le nom du foyer, sans quoi le lien continue d'en révéler
-- l'existence.

create or replace function public.invitation_details(invite_token uuid)
returns table (prenom text, relation text, household_name text, is_pending boolean)
language sql
stable
security definer
set search_path = public
as $$
  select i.prenom, i.relation, h.name,
         (i.accepted_at is null and i.expires_at > now())
  from public.invitations i
  join public.households h on h.id = i.household_id
  where i.token = invite_token;
$$;
grant execute on function public.invitation_details(uuid) to anon, authenticated;

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
  where token = invite_token
    and accepted_at is null
    and expires_at > now();
  if not found then
    raise exception 'invitation invalide, expirée ou déjà utilisée';
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
