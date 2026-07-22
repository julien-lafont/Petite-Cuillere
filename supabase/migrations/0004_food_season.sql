-- ============================================================================
-- Baby Food Tracker — Saisonnalité des fruits & légumes (France)
-- ============================================================================
-- `season` : intervalles de mois inclusifs, ex. '[[6,8],[1,3]]' = juin→août + janv→mars.
-- NULL = pas de saison (viande, œuf, laitages, féculents, banane importée…).
-- Sources : ADEME, Greenpeace, interfel (lesfruitsetlegumesfrais.com). Valeurs médianes.
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

alter table public.foods
  add column if not exists season jsonb;

-- Légumes
update public.foods set season = '[[5,11]]'          where name = 'Carotte' and household_id is null;
update public.foods set season = '[[6,9]]'           where name = 'Haricot vert' and household_id is null;
update public.foods set season = '[[6,9]]'           where name = 'Courgette' and household_id is null;
update public.foods set season = '[[9,12]]'          where name = 'Potiron' and household_id is null;
update public.foods set season = '[[9,12]]'          where name = 'Courge' and household_id is null;
update public.foods set season = '[[3,6],[9,11]]'    where name = 'Épinard' and household_id is null;
update public.foods set season = '[[1,4],[9,12]]'    where name = 'Blanc de poireau' and household_id is null;
update public.foods set season = '[[6,11]]'          where name = 'Brocoli' and household_id is null;
update public.foods set season = '[[1,2],[10,12]]'   where name = 'Panais' and household_id is null;
update public.foods set season = '[[5,7]]'           where name = 'Petits pois' and household_id is null;
update public.foods set season = '[[1,3],[9,12]]'    where name = 'Chou' and household_id is null;
update public.foods set season = '[[1,3],[10,12]]'   where name = 'Navet' and household_id is null;
update public.foods set season = '[[6,10]]'          where name = 'Fenouil' and household_id is null;

-- Fruits
update public.foods set season = '[[8,11]]'          where name = 'Pomme' and household_id is null;
update public.foods set season = '[[8,11]]'          where name = 'Poire' and household_id is null;
update public.foods set season = '[[6,8]]'           where name = 'Abricot' and household_id is null;
update public.foods set season = '[[6,9]]'           where name = 'Pêche' and household_id is null;
update public.foods set season = '[[5,7]]'           where name = 'Fraise' and household_id is null;
update public.foods set season = '[[7,9]]'           where name = 'Myrtille' and household_id is null;
-- Banane : importée, pas de saison française → NULL (laissé tel quel).
