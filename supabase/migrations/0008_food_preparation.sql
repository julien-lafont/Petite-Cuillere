-- ============================================================================
-- Petite Cuillère — Données de préparation du catalogue commun
-- ============================================================================
-- L'écran « Aujourd'hui » doit répondre à « quoi · combien · comment » sans que
-- le parent ait la moindre décision à prendre (cf. docs/ux-redesign.md §5).
-- Le champ `preparation` existant est une phrase libre : utile en consultation,
-- inexploitable pour composer un pas-à-pas.
--
-- On ajoute donc les deux données manquantes, en supposant un cuiseur-mixeur
-- de type Babycook (hypothèse validée au cadrage) :
--   · cook_minutes : durée de cuisson vapeur, en minutes (0 = pas de cuisson)
--   · prep_note    : le geste préalable, à l'impératif, en une ligne
--
-- Les quantités NE sont pas stockées ici : elles dépendent de l'âge de l'enfant
-- et du temps écoulé depuis le début de la diversification. Elles sont calculées
-- (src/lib/portions.ts).
-- ============================================================================

alter table public.foods
  add column if not exists cook_minutes int,
  add column if not exists prep_note text;

comment on column public.foods.cook_minutes is
  'Durée de cuisson vapeur en minutes (0 = aucune cuisson). Morceaux de 1 à 2 cm.';
comment on column public.foods.prep_note is
  'Geste de préparation préalable, à l''impératif, une ligne.';

-- ----------------------------------------------------------------------------
-- Légumes — vapeur, morceaux de 1 à 2 cm
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Fruits — cuits, sauf ceux qui se donnent crus bien mûrs
-- ----------------------------------------------------------------------------
update public.foods set cook_minutes = 10, prep_note = 'Épluche, retire le cœur et coupe en morceaux' where household_id is null and name = 'Pomme';
update public.foods set cook_minutes = 8,  prep_note = 'Épluche, retire le cœur et coupe en morceaux' where household_id is null and name = 'Poire';
update public.foods set cook_minutes = 0,  prep_note = 'Choisis-la bien mûre et écrase-la à la fourchette' where household_id is null and name = 'Banane';
update public.foods set cook_minutes = 8,  prep_note = 'Dénoyaute et coupe en quartiers' where household_id is null and name = 'Abricot';
update public.foods set cook_minutes = 8,  prep_note = 'Épluche, dénoyaute et coupe en quartiers' where household_id is null and name = 'Pêche';
update public.foods set cook_minutes = 0,  prep_note = 'Équeute, lave et mixe crue (bien mûre)' where household_id is null and name = 'Fraise';
update public.foods set cook_minutes = 5,  prep_note = 'Rince (une cuisson courte facilite le mixage)' where household_id is null and name = 'Myrtille';

-- ----------------------------------------------------------------------------
-- Protéines — bien cuites, sans exception
-- ----------------------------------------------------------------------------
update public.foods set cook_minutes = 15, prep_note = 'Retire la peau et le gras, coupe en dés' where household_id is null and name = 'Poulet';
update public.foods set cook_minutes = 15, prep_note = 'Coupe en petits dés, sans gras' where household_id is null and name = 'Bœuf';
update public.foods set cook_minutes = 0,  prep_note = 'Découenne et retire le gras (déjà cuit)' where household_id is null and name = 'Jambon blanc';
update public.foods set cook_minutes = 10, prep_note = 'Vérifie l''absence d''arêtes, coupe en morceaux' where household_id is null and name = 'Poisson blanc';
update public.foods set cook_minutes = 10, prep_note = 'Vérifie l''absence d''arêtes, coupe en morceaux' where household_id is null and name = 'Poisson gras (sardine, maquereau)';
update public.foods set cook_minutes = 10, prep_note = 'Cuis-le dur (10 min à l''eau bouillante), jaune et blanc' where household_id is null and name = 'Œuf dur';

-- ----------------------------------------------------------------------------
-- Féculents
-- ----------------------------------------------------------------------------
update public.foods set cook_minutes = 5,  prep_note = 'Verse en pluie dans du liquide chaud' where household_id is null and name = 'Semoule';
update public.foods set cook_minutes = 20, prep_note = 'Rince, puis cuis dans un grand volume d''eau' where household_id is null and name = 'Riz';
update public.foods set cook_minutes = 10, prep_note = 'Choisis de petites formes et cuis-les bien tendres' where household_id is null and name = 'Pâtes';
update public.foods set cook_minutes = 20, prep_note = 'Épluche et coupe en cubes' where household_id is null and name = 'Pomme de terre';
update public.foods set cook_minutes = 20, prep_note = 'Épluche et coupe en cubes' where household_id is null and name = 'Patate douce';
update public.foods set cook_minutes = 25, prep_note = 'Rince abondamment' where household_id is null and name = 'Lentilles';
update public.foods set cook_minutes = 10, prep_note = 'En conserve : rince bien et retire les peaux' where household_id is null and name = 'Pois chiches';
update public.foods set cook_minutes = 0,  prep_note = 'Donne la croûte ou un morceau de mie, sous surveillance' where household_id is null and name = 'Pain';

-- ----------------------------------------------------------------------------
-- Laitiers, matières grasses, divers — aucune cuisson
-- ----------------------------------------------------------------------------
update public.foods set cook_minutes = 0, prep_note = 'Sers-le nature, sans sucre ajouté' where household_id is null and name in ('Petit-suisse', 'Yaourt bébé', 'Fromage blanc');
update public.foods set cook_minutes = 0, prep_note = 'Râpe finement (pâte pressée cuite uniquement)' where household_id is null and name = 'Fromage à pâte pressée';
update public.foods set cook_minutes = 0, prep_note = 'Ajoute-la crue, hors cuisson, juste avant de servir' where household_id is null and name in ('Huile de colza', 'Huile de noix');
update public.foods set cook_minutes = 0, prep_note = 'Ajoute-le hors cuisson, juste avant de servir' where household_id is null and name = 'Beurre';
update public.foods set cook_minutes = 0, prep_note = 'Une pointe diluée dans une purée ou un laitage — jamais de cacahuète entière' where household_id is null and name = 'Beurre de cacahuète';
update public.foods set cook_minutes = 0, prep_note = 'Interdit avant 12 mois (botulisme)' where household_id is null and name = 'Miel';
