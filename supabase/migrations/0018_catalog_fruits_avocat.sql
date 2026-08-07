-- ============================================================================
-- Petite Cuillère — Mangue, melon, raisin, avocat au catalogue commun
-- ============================================================================
-- Le catalogue fruits était saturé sur l'été (abricot, pêche, fraise, myrtille,
-- framboise) et vide de décembre à avril : seule la banane, non saisonnière,
-- restait planifiable. On ajoute quatre classiques français qui manquaient :
--
--   · Mangue — non saisonnière comme la banane, texture idéale écrasée crue et
--     aucune cuisson. Placée tôt dans l'ordre de découverte (4e fruit, juste
--     après la banane) : c'est un fruit doux, sans acidité ni pépins.
--   · Melon — été, cru bien mûr, zéro préparation.
--   · Raisin — automne. Le grain entier est l'un des pires risques de fausse
--     route avant 4 ans, d'où une `restrictions` explicite : mixé et passé.
--   · Avocat — classé **légume** et non fruit, bien qu'il en soit un
--     botaniquement. La catégorie pilote le créneau de repas (`slotCats` dans
--     src/lib/program/schedule.ts) : `fruit` va au goûter et au dessert,
--     `légume` au déjeuner et au dîner. Un avocat se sert écrasé dans une purée
--     salée, pas en dessert.
--
-- Mangue, melon et raisin restent à 4 mois comme tous les autres fruits du
-- catalogue : « tous les fruits et légumes, même réputés allergisants, dès le
-- début » (docs/diversification-guide.md §3). C'est `intro_order` qui les place
-- tard dans la découverte, pas un plancher d'âge.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Les quatre aliments
-- ----------------------------------------------------------------------------
-- `on conflict` s'appuie sur foods_common_name_key (index unique partiel sur
-- name where household_id is null, posé en 0016).

insert into public.foods
  (name, category, age_introduction_min, is_allergen, allergen_type,
   texture, preparation, restrictions, quantite_indicative)
values
  ('Mangue', 'fruit', 4, false, null,
   'Bien mûre, écrasée',
   'Bien mûre, pelée, écrasée à la fourchette. Sans sucre. Aucune cuisson.',
   null, null),
  ('Melon', 'fruit', 4, false, null,
   'Cru bien mûr, mixé',
   'Bien mûr, épépiné, mixé cru. Sans sucre.',
   null, null),
  ('Raisin', 'fruit', 4, false, null,
   'Mixé et passé',
   'Sans pépins, lavé, mixé puis passé pour retirer les peaux. Sans sucre.',
   'Jamais de grain entier avant 4 ans (fausse route) : mixé, ou coupé en quatre dans la longueur pour les plus grands.',
   null),
  ('Avocat', 'légume', 4, false, null,
   'Cru, écrasé',
   'Bien mûr, cru, écrasé à la fourchette et délayé si besoin. Aucune cuisson. Riche en bons lipides.',
   null, null)
on conflict (name) where household_id is null do update set
  category             = excluded.category,
  age_introduction_min = excluded.age_introduction_min,
  is_allergen          = excluded.is_allergen,
  allergen_type        = excluded.allergen_type,
  texture              = excluded.texture,
  preparation          = excluded.preparation,
  restrictions         = excluded.restrictions,
  quantite_indicative  = excluded.quantite_indicative;

-- ----------------------------------------------------------------------------
-- 2. Saisonnalité (France)
-- ----------------------------------------------------------------------------
-- Mangue et avocat n'ont pas de saison française : `null`, comme la banane —
-- freshnessAdvice() ne conseille alors ni frais ni surgelé.
update public.foods set season = null            where name in ('Mangue', 'Avocat') and household_id is null;
update public.foods set season = '[[6,9]]'       where name = 'Melon' and household_id is null;
update public.foods set season = '[[9,10]]'      where name = 'Raisin' and household_id is null;

-- Rattrapage : ces deux fruits, ajoutés en 0016, n'avaient jamais reçu de
-- saison — ils s'affichaient donc « hors saison » toute l'année.
update public.foods set season = '[[6,10]]'      where name = 'Framboise' and household_id is null;
update public.foods set season = '[[11,12],[1,3]]' where name = 'Kiwi' and household_id is null;

-- ----------------------------------------------------------------------------
-- 3. Ordre de découverte
-- ----------------------------------------------------------------------------
-- La mangue s'insère en 4e position : les fruits suivants décalent d'un rang.
-- L'ordre est relatif et par catégorie ; seul l'écart compte.
update public.foods set intro_order = 4  where name = 'Mangue' and household_id is null;
update public.foods set intro_order = 5  where name = 'Abricot' and household_id is null;
update public.foods set intro_order = 6  where name = 'Pêche' and household_id is null;
update public.foods set intro_order = 7  where name = 'Fraise' and household_id is null;
update public.foods set intro_order = 8  where name = 'Myrtille' and household_id is null;
update public.foods set intro_order = 9  where name = 'Framboise' and household_id is null;
update public.foods set intro_order = 10 where name = 'Kiwi' and household_id is null;
update public.foods set intro_order = 11 where name = 'Melon' and household_id is null;
update public.foods set intro_order = 12 where name = 'Raisin' and household_id is null;

-- L'avocat ferme la liste des légumes, derrière chou/navet/fenouil (21-23).
update public.foods set intro_order = 24 where name = 'Avocat' and household_id is null;

-- ----------------------------------------------------------------------------
-- 4. Préparation (cuisson + geste préalable)
-- ----------------------------------------------------------------------------
update public.foods set cook_minutes = 0, prep_note = 'Choisis-la bien mûre, pèle-la et détache la chair du noyau' where household_id is null and name = 'Mangue';
update public.foods set cook_minutes = 0, prep_note = 'Épépine, retire l''écorce et coupe la chair en cubes' where household_id is null and name = 'Melon';
update public.foods set cook_minutes = 0, prep_note = 'Lave, égrappe, mixe et passe pour retirer les peaux' where household_id is null and name = 'Raisin';
update public.foods set cook_minutes = 0, prep_note = 'Choisis-le souple sous le pouce, dénoyaute et prélève la chair à la cuillère' where household_id is null and name = 'Avocat';

-- ----------------------------------------------------------------------------
-- 5. Rattrapage : les aliments de 0016 n'ont jamais reçu de préparation
-- ----------------------------------------------------------------------------
-- 0016 a ajouté onze aliments sans rejouer pour eux la section préparation de
-- 0008 — leur `prep_note` est resté NULL. buildRecipe() (src/lib/recipe.ts)
-- n'émet alors aucune étape pour eux : la recette les passe sous silence.
-- reset.sql, écrit après, contient déjà ces valeurs ; sans ce bloc, une base
-- montée par migrations diverge d'une base repartie de reset.sql.
update public.foods set cook_minutes = 0,  prep_note = 'Écrase-la et passe-la pour retirer les grains' where household_id is null and name = 'Framboise' and prep_note is null;
update public.foods set cook_minutes = 0,  prep_note = 'Pèle-le bien mûr et écrase-le à la fourchette' where household_id is null and name = 'Kiwi' and prep_note is null;
update public.foods set cook_minutes = 5,  prep_note = 'Décortique entièrement et retire le boyau' where household_id is null and name = 'Crevette' and prep_note is null;
update public.foods set cook_minutes = 12, prep_note = 'Rince, puis cuis comme une semoule' where household_id is null and name = 'Sarrasin' and prep_note is null;
update public.foods set cook_minutes = 0,  prep_note = 'Une pointe de couteau mélangée au plat, une fois cuit' where household_id is null and name = 'Moutarde' and prep_note is null;
update public.foods set cook_minutes = 0,  prep_note = 'Écrase une pointe et mélange-la à une purée' where household_id is null and name = 'Tofu soyeux' and prep_note is null;
update public.foods set cook_minutes = 0,  prep_note = 'Délaie 1 c. à café dans un biberon' where household_id is null and name = 'Farine infantile avec gluten' and prep_note is null;
update public.foods set cook_minutes = 0,  prep_note = 'Délaie une pointe dans une compote ou une purée — jamais de fruit à coque entier' where household_id is null and name in ('Purée de noisette', 'Purée d''amande', 'Purée de noix de cajou', 'Purée de pistache', 'Purée de noix') and prep_note is null;
update public.foods set cook_minutes = 0,  prep_note = 'Délaie une pointe dans une compote ou une purée' where household_id is null and name = 'Purée de sésame (tahini)' and prep_note is null;
