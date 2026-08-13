-- ============================================================================
-- Petite Cuillère — Borner la date de naissance
-- ============================================================================
-- La durée du programme se déduit de cette date : `programDaysFrom` la traduit
-- en jours, et `buildPlan` boucle sur chacun d'eux en allouant des repas. Une
-- date dans le futur donne des mois négatifs — 2200 vaut 63 726 jours, 9999 en
-- vaut 2 912 545 — et suffit à faire tomber la fonction serveur à chaque
-- écriture, ou à insérer des centaines de milliers de repas sur une base
-- partagée par tous les foyers.
--
-- L'application refuse désormais ces dates (`birthDateIssue`), mais elle est le
-- seul contrôle : PostgREST accepte tout ce que la RLS laisse passer, et la
-- colonne est écrite par un `update` ordinaire. La contrainte est la borne qui
-- ne se contourne pas.
--
-- Un jour de tolérance sur le futur : le serveur tourne en UTC, et un foyer en
-- avance sur lui verrait sinon refuser son propre aujourd'hui.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

-- Rattrapage des dates déjà posées dans le futur : elles ne décrivent aucun
-- enfant réel, et leur programme est de toute façon inexploitable.
update public.babies
  set date_naissance = current_date
  where date_naissance > current_date;

alter table public.babies
  drop constraint if exists babies_date_naissance_bounds;

-- `not valid` : la contrainte vaut pour toute écriture, sans re-valider les
-- lignes existantes. Un profil d'avant la borne inférieure — un compte de test,
-- une saisie ancienne — ne doit pas faire échouer la migration ; l'application
-- refuse déjà de le modifier, il a passé le premier anniversaire.
alter table public.babies
  add constraint babies_date_naissance_bounds
  check (
    date_naissance >= date '2000-01-01'
    and date_naissance <= current_date + 1
  )
  not valid;

comment on constraint babies_date_naissance_bounds on public.babies is
  'Garde-fou : la durée du programme se déduit de cette date.';
