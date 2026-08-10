-- ============================================================================
-- Petite Cuillère — un moment de repas est un créneau horaire
-- ============================================================================
-- Un moment n'était qu'un nom et un rang. L'application savait donc dans quel
-- ORDRE les repas se suivent, jamais OÙ ON EN EST : à 16 h, le dîner comptait
-- déjà comme mangé, le goûter n'était réclamé nulle part, et « il a mangé des
-- courgettes » se rangeait au petit bonheur.
--
-- Trois règles, portées par le schéma plutôt que par le code :
--
--   1. un moment occupe un intervalle [début, fin[ — 18 h 00 appartient au
--      dîner, pas au goûter qui s'arrête à 18 h ;
--   2. deux moments d'un même foyer ne se chevauchent jamais (contrainte
--      d'exclusion) — c'est ce qui permet à `currentMoment()` de renvoyer UN
--      moment et non une liste ;
--   3. la journée n'a pas à être couverte. 10 h 30 n'appartient à aucun
--      créneau, et c'est le cas normal — cf. docs/feats/creneaux-horaires.md §3.
--
-- S'ajoute le fuseau du foyer. Tout le code serveur faisait `new Date()`, donc
-- l'heure de Vercel (UTC) : entre minuit et 2 h, l'application croyait encore
-- être la veille. Invisible tant que rien ne dépendait de l'heure, bloquant
-- maintenant. Le fuseau appartient au FOYER et non à l'appareil : les repas ont
-- lieu chez l'enfant, un aidant en déplacement doit voir la journée du bébé.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

-- `btree_gist` permet de mêler l'égalité (household_id) et le chevauchement
-- (int4range) dans une même contrainte d'exclusion.
create extension if not exists btree_gist;

-- ----------------------------------------------------------------------------
-- 1. L'horloge du foyer
-- ----------------------------------------------------------------------------

alter table public.households
  add column if not exists timezone text not null default 'Europe/Paris';

comment on column public.households.timezone is
  'Fuseau IANA du foyer. Détecté au premier chargement, jamais exposé dans l''interface. C''est l''horloge de l''enfant : un aidant en déplacement voit la journée du bébé, pas la sienne.';

-- ----------------------------------------------------------------------------
-- 2. Les bornes du créneau
-- ----------------------------------------------------------------------------
-- Minutes depuis minuit local, 0 → 1440. Un entier plutôt qu'un `time` : c'est
-- ce que le code compare, sérialise et teste, sans jamais retomber sur un
-- fuseau au passage.

alter table public.meal_moments
  add column if not exists start_minute int,
  add column if not exists end_minute   int;

-- ----------------------------------------------------------------------------
-- 3. Les moments déjà en base
-- ----------------------------------------------------------------------------
-- Par libellé, du plus spécifique au plus général : « Petit-déjeuner » contient
-- « déjeuner », d'où l'ordre des quatre requêtes et le garde `is null`.
--
-- La collation prend le trou de 10 h à 11 h que laissent les valeurs par
-- défaut : c'est son heure, et c'est le seul créneau qui ne heurte personne.

update public.meal_moments set start_minute =  6*60, end_minute = 10*60
  where start_minute is null and label ~* '(petit.?d[ée]j|matin|r[ée]veil)';

update public.meal_moments set start_minute = 10*60, end_minute = 11*60
  where start_minute is null and label ~* 'collation';

update public.meal_moments set start_minute = 11*60, end_minute = 14*60
  where start_minute is null and label ~* '(d[ée]jeuner|midi)';

update public.meal_moments set start_minute = 15*60, end_minute = 18*60
  where start_minute is null and label ~* '(go[uû]ter|apr[èe]s.?midi)';

update public.meal_moments set start_minute = 18*60, end_minute = 22*60
  where start_minute is null and label ~* '(d[îi]ner|souper|soir|coucher)';

-- Les libellés qu'aucun motif ne reconnaît (« Chez la nounou », « Biberon »…)
-- reçoivent la première heure pleine encore libre de leur foyer. Un placement
-- approximatif que le parent corrigera vaut mieux qu'un moment sans heure, que
-- toutes les règles du produit devraient ensuite traiter à part.
do $$
declare
  moment       record;
  hour_index   int;
  free_start   int;
begin
  for moment in
    select id, household_id
      from public.meal_moments
     where start_minute is null
     order by household_id, position, created_at
  loop
    free_start := null;
    for hour_index in 0..23 loop
      if not exists (
        select 1
          from public.meal_moments other
         where other.household_id = moment.household_id
           and other.start_minute is not null
           and int4range(other.start_minute, other.end_minute)
               && int4range(hour_index * 60, hour_index * 60 + 60)
      ) then
        free_start := hour_index * 60;
        exit;
      end if;
    end loop;

    if free_start is null then
      raise exception
        'Foyer % : les 24 heures sont occupées, impossible de placer le moment %. Supprimez ou fusionnez un moment avant de rejouer cette migration.',
        moment.household_id, moment.id;
    end if;

    update public.meal_moments
       set start_minute = free_start, end_minute = free_start + 60
     where id = moment.id;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 4. Les invariants
-- ----------------------------------------------------------------------------

alter table public.meal_moments
  alter column start_minute set not null,
  alter column end_minute   set not null;

alter table public.meal_moments
  drop constraint if exists meal_moments_window;
alter table public.meal_moments
  add constraint meal_moments_window check (
    start_minute >= 0 and end_minute <= 1440 and start_minute < end_minute
  );

-- Pas de chevauchement dans un même foyer. `&&` sur `int4range` traite la borne
-- haute comme exclue : [15 h, 18 h[ et [18 h, 22 h[ sont contigus, pas en
-- conflit.
alter table public.meal_moments
  drop constraint if exists meal_moments_no_overlap;
alter table public.meal_moments
  add constraint meal_moments_no_overlap exclude using gist (
    household_id with =,
    int4range(start_minute, end_minute) with &&
  );

comment on column public.meal_moments.start_minute is
  'Début du créneau, en minutes depuis minuit local (6 h → 360). Borne incluse.';
comment on column public.meal_moments.end_minute is
  'Fin du créneau, en minutes depuis minuit local (10 h → 600). Borne EXCLUE : 18 h 00 appartient au dîner qui commence, pas au goûter qui finit.';

-- ----------------------------------------------------------------------------
-- 5. `position` devient dérivée
-- ----------------------------------------------------------------------------
-- L'ordre d'affichage ne peut plus contredire l'ordre horaire : il s'en déduit.
-- La colonne reste, parce que la moitié du code trie dessus, mais plus personne
-- ne l'écrit à la main — `reorderMealMoment` disparaît côté application.

with ranked as (
  select id,
         row_number() over (
           partition by household_id order by start_minute
         )::int - 1 as rank
    from public.meal_moments
)
update public.meal_moments m
   set position = ranked.rank
  from ranked
 where ranked.id = m.id
   and m.position is distinct from ranked.rank;

comment on column public.meal_moments.position is
  'Ordre d''affichage, DÉRIVÉ de start_minute. Recalculé à chaque écriture (cf. lib/data/meal-moments.actions.ts) : ne jamais l''écrire seul.';

-- ----------------------------------------------------------------------------
-- 6. Les moments par défaut d'un nouveau foyer
-- ----------------------------------------------------------------------------
-- Deux trous assumés — [10 h, 11 h[ et [14 h, 15 h[ — et une jointure franche
-- entre goûter et dîner. Un jeu qui couvrirait la journée entière masquerait le
-- cas « on est entre deux repas » au lieu de le régler.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_household_id uuid;
begin
  insert into public.households (name) values ('Notre foyer') returning id into new_household_id;
  -- « Parent » : rôle par défaut du responsable, qui crée le foyer pour son enfant.
  insert into public.profiles (id, email, household_id, relation)
    values (new.id, new.email, new_household_id, 'Parent');
  update public.households set owner_id = new.id where id = new_household_id;
  insert into public.meal_moments (household_id, label, position, start_minute, end_minute) values
    (new_household_id, 'Petit-déjeuner', 0,  6*60, 10*60),
    (new_household_id, 'Déjeuner',       1, 11*60, 14*60),
    (new_household_id, 'Goûter',         2, 15*60, 18*60),
    (new_household_id, 'Dîner',          3, 18*60, 22*60);
  return new;
end;
$$;
