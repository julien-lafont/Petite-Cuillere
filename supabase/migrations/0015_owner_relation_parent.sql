-- ============================================================================
-- Petite Cuillère — Rôle « Parent » pour le responsable du foyer
-- ============================================================================
-- Les aidants invités arrivent avec un prénom et une relation (« Nounou »,
-- « Grand-mère »…) saisis par le responsable. Le responsable, lui, se crée seul
-- à l'inscription : sans relation, la liste du foyer se rabattait sur son
-- email — une adresse n'est pas un rôle, et c'est le seul membre à ne pas dire
-- qui il est pour l'enfant.
--
-- On pose donc « Parent » à la création du compte. C'est un point de départ,
-- pas une vérité figée : la valeur reste modifiable comme celle des aidants
-- (« Papa », « Maman »…).
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_household_id uuid;
begin
  insert into public.households (name) values ('Notre foyer') returning id into new_household_id;
  -- « Parent » : rôle par défaut du responsable, qui crée le foyer pour son enfant.
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

-- Rattrapage des responsables déjà inscrits. Seuls ceux qui n'ont rien
-- renseigné sont touchés : une relation choisie à la main reste intacte.
update public.profiles p
  set relation = 'Parent'
  from public.households h
  where h.owner_id = p.id
    and p.relation is null;
