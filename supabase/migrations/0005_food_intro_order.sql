-- ============================================================================
-- Baby Food Tracker — Ordre de découverte (guide Aiguelongue)
-- ============================================================================
-- `intro_order` : ordre d'introduction conseillé au sein d'une catégorie
-- (plus petit = plus tôt). NULL = pas d'ordre particulier (trié par nom).
-- Utilisé par le générateur de programme auto.
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

alter table public.foods
  add column if not exists intro_order int;

-- Légumes — ordre du guide : carotte d'abord, puis légumes doux/non filandreux ;
-- pomme de terre = liant (féculent) ; légumes à goût fort / fibreux en dernier.
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
-- À goût fort / fibreux : plus tard
update public.foods set intro_order = 21 where name = 'Chou' and household_id is null;
update public.foods set intro_order = 22 where name = 'Navet' and household_id is null;
update public.foods set intro_order = 23 where name = 'Fenouil' and household_id is null;

-- Fruits — pomme/poire/banane, puis jaunes, puis rouges
update public.foods set intro_order = 1 where name = 'Pomme' and household_id is null;
update public.foods set intro_order = 2 where name = 'Poire' and household_id is null;
update public.foods set intro_order = 3 where name = 'Banane' and household_id is null;
update public.foods set intro_order = 4 where name = 'Abricot' and household_id is null;
update public.foods set intro_order = 5 where name = 'Pêche' and household_id is null;
update public.foods set intro_order = 6 where name = 'Fraise' and household_id is null;
update public.foods set intro_order = 7 where name = 'Myrtille' and household_id is null;
