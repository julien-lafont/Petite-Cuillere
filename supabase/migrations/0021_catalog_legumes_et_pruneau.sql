-- ============================================================================
-- Petite Cuillère — Tomate, betterave, aubergine, poivron, pruneau
-- ============================================================================
-- Le catalogue comptait quatorze légumes, et le croisement avec la consommation
-- réelle en France laissait deux trous.
--
--   · Les plus achetés manquaient. La tomate est le premier légume acheté en
--     France (≈ 18 % des achats, devant la carotte et la courgette) ; ni elle,
--     ni l'aubergine, ni le poivron, ni la betterave n'étaient au catalogue.
--   · Aucun d'eux n'est un légume d'hiver, en revanche : le trou de saison
--     d'avril-mai (2 légumes seulement) reste entier et attend le chou-fleur,
--     la blette ou l'asperge. Ce n'est pas l'objet de cette migration.
--
-- S'ajoute un fruit, le **pruneau**, demandé pour le transit. Il pose un
-- problème que le catalogue ne savait pas exprimer : `portionFor`
-- (src/lib/portions.ts) donne à tout aliment de catégorie `fruit` la portion
-- fruit/légume de l'âge — soit ~180 g à 8 mois. 180 g de pruneaux ne sont pas
-- une compote, c'est une journée difficile. D'où les deux colonnes ci-dessous.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Portion propre à un aliment
-- ----------------------------------------------------------------------------
-- Troisième source de quantité, après la dose du protocole allergènes et la
-- règle par catégorie — et la seule des trois qui vive dans le catalogue. Elle
-- sert aux aliments dont la catégorie dit bien où ils se mangent (le pruneau
-- est un dessert) mais pas combien on en donne.
--
-- `portion_grams` reste renseigné quand la quantité a un sens en poids : c'est
-- lui qui alimente la liste de courses. NULL = « selon besoin ».

alter table public.foods
  add column if not exists portion_label text,
  add column if not exists portion_grams int;

comment on column public.foods.portion_label is
  'Portion propre à l''aliment, affichée telle quelle. Court-circuite la règle par catégorie de portionFor(). NULL = règle par catégorie.';
comment on column public.foods.portion_grams is
  'Grammes correspondant à portion_label, pour l''agrégation de la liste de courses. NULL = pas de poids pertinent.';

-- ----------------------------------------------------------------------------
-- 2. Les cinq aliments
-- ----------------------------------------------------------------------------
-- `on conflict` s'appuie sur foods_common_name_key (index unique partiel sur
-- name where household_id is null, posé en 0016).
--
-- Âges : 6 mois pour les trois premiers, comme chou/navet/fenouil — ce sont des
-- légumes à goût marqué, pas des légumes de démarrage. Le poivron va à 8 mois :
-- les sources divergent (4-6 mois pelé chez les uns, 8 mois chez les autres) et
-- le plancher prudent ne coûte rien ici, son `intro_order` le plaçant de toute
-- façon en fin de liste. Le pruneau reste à 4 mois comme tous les fruits.

insert into public.foods
  (name, category, age_introduction_min, is_allergen, allergen_type,
   texture, preparation, restrictions, quantite_indicative)
values
  ('Tomate', 'légume', 6, false, null,
   'Cuite, pelée, mixée',
   'Mondée, épépinée, cuite puis mixée. L''acidité s''adoucit à la cuisson : elle passe mieux mélangée à une pomme de terre ou à une courgette.',
   null, null),
  ('Betterave', 'légume', 6, false, null,
   'Cuite, mixée',
   'La betterave cuite sous vide convient parfaitement : pelée, puis mixée. Douce et sucrée, c''est l''un des légumes les mieux acceptés.',
   'Riche en nitrates : quelques cuillères à la fois, et pas tous les jours avant 1 an.',
   null),
  ('Aubergine', 'légume', 6, false, null,
   'Cuite, pelée, mixée',
   'Pelée et débarrassée de ses grosses graines — ni la peau ni les graines ne se digèrent — puis cuite et mixée.',
   null, null),
  ('Poivron', 'légume', 8, false, null,
   'Cuit, pelé, mixé',
   'Pelé à l''économe, épépiné, cuit puis mixé. Goût marqué : à servir mélangé, jamais seul.',
   null, null),
  ('Pruneau', 'fruit', 4, false, null,
   'Réhydraté, mixé',
   'Dénoyauté, réhydraté à l''eau chaude puis mixé. À mélanger à un autre fruit — seul, il est très concentré. Naturellement riche en fibres, il aide le transit.',
   'Jamais entier avant 4 ans (fausse route). Riche en fibres et en sucres : 1 à 2 pruneaux suffisent, 3 au plus si le transit est bloqué, une fois par jour.',
   '1 pruneau pour une pomme ; jusqu''à 3 en cas de constipation')
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
-- 3. Saisonnalité (France)
-- ----------------------------------------------------------------------------
update public.foods set season = '[[6,9]]'  where name = 'Tomate' and household_id is null;
update public.foods set season = '[[7,9]]'  where name = 'Aubergine' and household_id is null;
update public.foods set season = '[[7,10]]' where name = 'Poivron' and household_id is null;

-- Betterave et pruneau : `null`, mais pour deux raisons différentes.
-- La betterave a bien une saison au champ ; seulement, celle qu'on achète est
-- cuite sous vide et se trouve toute l'année. `freshnessAdvice` ne sait dire que
-- « frais » ou « surgelé » (src/lib/season.ts) : lui faire conseiller du surgelé
-- en avril serait faux. Le pruneau, lui, est un fruit sec — la question ne se
-- pose pas.
update public.foods set season = null where name in ('Betterave', 'Pruneau') and household_id is null;

-- ----------------------------------------------------------------------------
-- 4. Ordre de découverte
-- ----------------------------------------------------------------------------
-- L'intervalle 11-20 était resté libre entre les dix légumes du guide et les
-- légumes à goût fort (chou 21, navet 22, fenouil 23, avocat 24) : les deux
-- légumes doux s'y installent, les deux marqués prennent la suite de l'avocat.
update public.foods set intro_order = 11 where name = 'Betterave' and household_id is null;
update public.foods set intro_order = 12 where name = 'Tomate' and household_id is null;
update public.foods set intro_order = 25 where name = 'Aubergine' and household_id is null;
update public.foods set intro_order = 26 where name = 'Poivron' and household_id is null;

-- Le pruneau ferme la liste des fruits, derrière le raisin (12) : on y vient
-- pour une raison précise, pas au fil de la découverte des goûts.
update public.foods set intro_order = 13 where name = 'Pruneau' and household_id is null;

-- ----------------------------------------------------------------------------
-- 5. Préparation (cuisson + geste préalable)
-- ----------------------------------------------------------------------------
update public.foods set cook_minutes = 8,  prep_note = 'Ébouillante-la 30 s pour la peler, épépine-la et coupe-la en quartiers' where household_id is null and name = 'Tomate';
update public.foods set cook_minutes = 20, prep_note = 'Épluche-la, retire les grosses graines et coupe la chair en dés' where household_id is null and name = 'Aubergine';
update public.foods set cook_minutes = 10, prep_note = 'Pèle-le à l''économe, retire les graines et les côtes blanches, coupe en lanières' where household_id is null and name = 'Poivron';

-- Betterave et pruneau n'ont pas de cuisson : l'une arrive déjà cuite, l'autre
-- se réhydrate. Leur geste se suffit à lui-même, comme celui du jambon blanc.
update public.foods set cook_minutes = 0, prep_note = 'Prends-la cuite sous vide, pèle-la et coupe-la en dés — elle est déjà cuite' where household_id is null and name = 'Betterave';
update public.foods set cook_minutes = 0, prep_note = 'Vérifie qu''ils sont bien dénoyautés et fais-les tremper 10 min dans l''eau chaude' where household_id is null and name = 'Pruneau';

-- ----------------------------------------------------------------------------
-- 6. Cuisson, préparation d'accueil, service à part (cf. 0019)
-- ----------------------------------------------------------------------------
update public.foods set cook_method = 'vapeur', course = 'salé', served_apart = false
  where household_id is null and name in ('Tomate', 'Aubergine', 'Poivron');
update public.foods set cook_method = 'aucune', course = 'salé', served_apart = false
  where household_id is null and name = 'Betterave';
update public.foods set cook_method = 'aucune', course = 'sucré', served_apart = false
  where household_id is null and name = 'Pruneau';

-- ----------------------------------------------------------------------------
-- 7. La portion du pruneau
-- ----------------------------------------------------------------------------
-- La seule raison d'être des colonnes ajoutées en 1. Vingt grammes ≈ deux
-- pruneaux dénoyautés : c'est ce que la liste de courses agrège, pendant que le
-- parent lit « 1 à 2 pruneaux » sur la fiche du repas.
update public.foods set portion_label = '1 à 2 pruneaux', portion_grams = 20
  where household_id is null and name = 'Pruneau';
