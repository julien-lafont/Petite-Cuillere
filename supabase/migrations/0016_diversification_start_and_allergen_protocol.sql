-- ============================================================================
-- Petite Cuillère — Ancienneté de diversification & protocole allergènes
-- ============================================================================
-- Deux manques structurels du générateur, corrigés ensemble parce qu'ils
-- partagent la même cause : le programme ne connaissait que l'âge de l'enfant.
--
-- 1. ANCIENNETÉ. Un enfant qui démarre à 7 mois ne peut pas recevoir d'emblée
--    tout ce qu'un enfant de 7 mois diversifié depuis trois mois reçoit. Mais
--    le décalage ne peut pas non plus être un simple retard : les morceaux
--    (ESPGHAN : 8-10 mois au plus tard), la fenêtre allergènes (4-12 mois) et
--    le besoin en fer (réserves épuisées à 6 mois) sont attachés à l'âge civil,
--    pas à l'ancienneté. D'où `diversification_started_on` : une seconde
--    horloge qui ne pilote que la *rampe*, jamais les plafonds d'âge.
--
-- 2. ALLERGÈNES. `intro_window` était du texte libre jamais lu, et 5 des 9
--    allergènes déclarés n'étaient portés par aucun aliment — donc jamais
--    introduits. On chiffre les fenêtres, on pose un ordre explicite (le tri
--    retombait sur une comparaison d'UUID), des doses, et une fréquence
--    d'entretien : ~2 g de protéine par semaine, en 2 prises, est la dose
--    retenue par les analyses LEAP + EAT et reprise en France.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enfant : date réelle de début de diversification, et risque atopique
-- ----------------------------------------------------------------------------

alter table public.babies
  add column if not exists diversification_started_on date,
  add column if not exists atopic_risk boolean not null default false;

comment on column public.babies.diversification_started_on is
  'Date réelle du premier aliment solide. NULL = pas encore commencé. Distincte '
  'de la date de génération du programme : elle mesure l''ancienneté, qui pilote '
  'la rampe d''ouverture des repas.';

comment on column public.babies.atopic_risk is
  'Dermatite atopique sévère ou allergie à l''œuf connue. Le protocole LEAP '
  'demande un avis médical avant l''arachide dans ce cas : le programme ne la '
  'planifie alors pas seul.';

-- ----------------------------------------------------------------------------
-- 2. Allergènes : fenêtre chiffrée, ordre, doses, entretien
-- ----------------------------------------------------------------------------

alter table public.allergens
  add column if not exists intro_order int,
  add column if not exists window_start_months numeric(4, 1),
  add column if not exists window_end_months numeric(4, 1),
  add column if not exists evidence_level text
    check (evidence_level in ('rct', 'standard')),
  add column if not exists starting_dose text,
  add column if not exists target_dose text,
  add column if not exists maintenance_per_week int not null default 2,
  add column if not exists requires_medical_advice boolean not null default false;

comment on column public.allergens.window_end_months is
  'Borne haute conseillée. Le générateur planifie à rebours depuis min(cette '
  'borne, 12 mois) pour qu''aucun allergène ne sorte de sa fenêtre.';

comment on column public.allergens.maintenance_per_week is
  'Expositions hebdomadaires visées après introduction. 0 = pas d''entretien '
  '(soja : allergène à introduire, mais aliment déconseillé avant 3 ans).';

-- Upsert par nom plutôt que delete/insert : `allergen_introductions` et
-- `meal_allergens` cascadent, on ne veut pas effacer l'historique d'un foyer.
create unique index if not exists allergens_common_name_key
  on public.allergens (name)
  where household_id is null;

insert into public.allergens
  (name, type, intro_order, window_start_months, window_end_months,
   evidence_level, starting_dose, target_dose, maintenance_per_week,
   requires_medical_advice, intro_window, note)
values
  -- Preuve d'essai randomisé (LEAP, PETIT/STAR) : fenêtre 4-6 mois, priorité absolue.
  ('Arachide', 'oléagineux', 1, 4, 6, 'rct',
   'Une pointe de cuillère de beurre de cacahuète délayé',
   '2 c. à café de beurre de cacahuète (≈ 2 g de protéine)', 2, true,
   'dès 4-6 mois',
   'Délayé dans une compote ou un laitage. Jamais de cacahuète entière avant 3 ans.'),
  ('Œuf', 'protéine', 2, 4, 6, 'rct',
   'Une pointe de cuillère de jaune d''œuf dur',
   '⅓ d''œuf dur (≈ 2 g de protéine)', 2, false,
   'dès 4-6 mois',
   'Toujours bien cuit (dur). Jamais cru ou peu cuit avant 5 ans.'),
  ('Lait de vache', 'protéine', 3, 4, 6, 'rct',
   'Une cuillère à café de laitage bébé nature',
   '50 g de laitage bébé (≈ 2 g de protéine)', 2, false,
   'dès 4-6 mois',
   'Via les laitages bébé. Le lait de vache en boisson attend 12 mois.'),

  -- Fenêtre large, preuve observationnelle (EAT) : à faire dans la foulée.
  ('Gluten', 'céréale', 4, 6, 8, 'standard',
   '1 c. à café de farine infantile avec gluten',
   '2 c. à café de farine, ou 50 g de semoule cuite', 2, false,
   'dès 6 mois',
   'Progressivement, dans un biberon puis dans les repas.'),
  ('Poisson', 'protéine', 5, 5.5, 8, 'standard',
   'Une pointe de cuillère de poisson blanc cuit',
   '10 g de poisson (≈ 2 g de protéine)', 2, false,
   'dès 5-6 mois',
   'Cuit, sans arêtes, non pané. Limiter les gros prédateurs (métaux lourds).'),
  ('Sésame', 'graine', 6, 5, 8, 'standard',
   'Une pointe de cuillère de purée de sésame',
   '2 c. à café de purée de sésame', 2, false,
   'dès 5-6 mois',
   'En purée (tahini), délayée dans une compote ou une purée de légumes.'),

  -- Fruits à coque, éclatés : la réactivité croisée n'est pas uniforme
  -- (noisette/amande/noix d'un côté, cajou/pistache de l'autre).
  ('Noisette', 'oléagineux', 7, 5, 8, 'standard',
   'Une pointe de cuillère de purée de noisette',
   '2 c. à café de purée de noisette', 2, false,
   'dès 5-6 mois',
   'En purée uniquement. Jamais de fruit à coque entier avant 3 ans.'),
  ('Amande', 'oléagineux', 8, 5, 8, 'standard',
   'Une pointe de cuillère de purée d''amande',
   '2 c. à café de purée d''amande', 2, false,
   'dès 5-6 mois',
   'En purée uniquement. Jamais de fruit à coque entier avant 3 ans.'),
  ('Noix de cajou', 'oléagineux', 9, 6, 9, 'standard',
   'Une pointe de cuillère de purée de cajou',
   '2 c. à café de purée de cajou', 2, false,
   'dès 6 mois',
   'Groupe distinct de la noisette : tolérer l''une ne présage pas de l''autre.'),
  ('Pistache', 'oléagineux', 10, 6, 9, 'standard',
   'Une pointe de cuillère de purée de pistache',
   '2 c. à café de purée de pistache', 2, false,
   'dès 6 mois',
   'Proche de la noix de cajou. En purée uniquement.'),
  ('Noix', 'oléagineux', 11, 6, 9, 'standard',
   'Une pointe de cuillère de purée de noix',
   '2 c. à café de purée de noix', 2, false,
   'dès 6 mois',
   'En purée uniquement. Jamais de fruit à coque entier avant 3 ans.'),

  -- Fréquents chez l'enfant en France (séries CICBAA), absents des listes
  -- anglo-saxonnes — d'où leur présence ici.
  ('Moutarde', 'condiment', 12, 6, 10, 'standard',
   'Une pointe de couteau dans un plat salé',
   'Une pointe de couteau, 2 fois par semaine', 2, false,
   'dès 6 mois',
   'Un des allergènes les plus fréquents chez l''enfant en France.'),
  ('Soja', 'légumineuse', 13, 6, 10, 'standard',
   'Une pointe de cuillère de tofu soyeux',
   'Trace uniquement — pas de consommation régulière', 0, false,
   'dès 6 mois',
   'Introduit comme allergène, mais le soja aliment est déconseillé avant 3 ans '
   '(phyto-œstrogènes) : pas d''entretien à dose.'),
  ('Fruits de mer', 'protéine', 14, 8, 12, 'standard',
   'Une pointe de cuillère de crevette cuite mixée',
   '10 g de crevette cuite', 2, false,
   'dès 8 mois',
   'Bien cuits, d''une zone d''élevage autorisée.'),
  ('Sarrasin', 'céréale', 15, 8, 12, 'standard',
   '1 c. à café de sarrasin cuit',
   '2 c. à café de sarrasin cuit', 2, false,
   'dès 8 mois',
   'Sans gluten, mais allergène à part entière — fréquent en France (galettes).'),
  ('Kiwi', 'fruit', 16, 8, 12, 'standard',
   '1 c. à café de kiwi bien mûr écrasé',
   '½ kiwi bien mûr', 2, false,
   'dès 8 mois',
   'Bien mûr et écrasé. Fréquent chez l''enfant en France.')
on conflict (name) where household_id is null do update set
  type                    = excluded.type,
  intro_order             = excluded.intro_order,
  window_start_months     = excluded.window_start_months,
  window_end_months       = excluded.window_end_months,
  evidence_level          = excluded.evidence_level,
  starting_dose           = excluded.starting_dose,
  target_dose             = excluded.target_dose,
  maintenance_per_week    = excluded.maintenance_per_week,
  requires_medical_advice = excluded.requires_medical_advice,
  intro_window            = excluded.intro_window,
  note                    = excluded.note;

-- « Fruits à coque » disparaît au profit des cinq fruits à coque nommés. On
-- reporte d'abord son historique sur la noisette (le plus fréquent en France)
-- pour ne perdre aucune exposition déjà déclarée par un parent.
update public.allergen_introductions ai
   set allergen_id = (
     select id from public.allergens
      where name = 'Noisette' and household_id is null
   )
 where exists (
   select 1 from public.allergens a
    where a.id = ai.allergen_id
      and a.name = 'Fruits à coque'
      and a.household_id is null
 )
   and not exists (
     select 1 from public.allergen_introductions other
      where other.baby_id = ai.baby_id
        and other.allergen_id = (
          select id from public.allergens
           where name = 'Noisette' and household_id is null
        )
   );

delete from public.allergens
 where name = 'Fruits à coque' and household_id is null;

-- ----------------------------------------------------------------------------
-- 3. Aliments : lien explicite vers l'allergène porté
-- ----------------------------------------------------------------------------
-- `allergen_type` reliait un aliment à son allergène par comparaison de
-- chaînes ('œuf' → « Œuf »), fragile et silencieusement cassable. On pose une
-- vraie clé étrangère ; `allergen_type` reste pour l'affichage.

alter table public.foods
  add column if not exists allergen_id uuid
    references public.allergens (id) on delete set null;

create unique index if not exists foods_common_name_key
  on public.foods (name)
  where household_id is null;

-- Nouveaux aliments vecteurs : sans eux, 9 des 16 allergènes n'ont aucun
-- support et ne peuvent pas être planifiés.
insert into public.foods
  (name, category, age_introduction_min, is_allergen, allergen_type, texture,
   preparation, restrictions, quantite_indicative, cook_minutes, intro_order)
values
  ('Purée de noisette', 'autre', 5, true, 'noisette', 'Purée lisse délayée',
   'Délayer dans une compote ou une purée de légumes. Sans sucre ni sel ajouté.',
   'Jamais de fruit à coque entier avant 3 ans (fausse route).',
   '2 c. à café', 0, 101),
  ('Purée d''amande', 'autre', 5, true, 'amande', 'Purée lisse délayée',
   'Délayer dans une compote ou une purée de légumes. Sans sucre ni sel ajouté.',
   'Jamais de fruit à coque entier avant 3 ans (fausse route).',
   '2 c. à café', 0, 102),
  ('Purée de sésame (tahini)', 'autre', 5, true, 'sésame', 'Purée lisse délayée',
   'Délayer dans une compote ou une purée de légumes. Sans sucre ni sel ajouté.',
   null, '2 c. à café', 0, 103),
  ('Purée de noix de cajou', 'autre', 6, true, 'noix de cajou',
   'Purée lisse délayée',
   'Délayer dans une compote ou une purée de légumes.',
   'Jamais de fruit à coque entier avant 3 ans (fausse route).',
   '2 c. à café', 0, 104),
  ('Purée de pistache', 'autre', 6, true, 'pistache', 'Purée lisse délayée',
   'Délayer dans une compote ou une purée de légumes.',
   'Jamais de fruit à coque entier avant 3 ans (fausse route).',
   '2 c. à café', 0, 105),
  ('Purée de noix', 'autre', 6, true, 'noix', 'Purée lisse délayée',
   'Délayer dans une compote ou une purée de légumes.',
   'Jamais de fruit à coque entier avant 3 ans (fausse route).',
   '2 c. à café', 0, 106),
  ('Moutarde', 'autre', 6, true, 'moutarde', 'Une pointe',
   'Une pointe de couteau dans un plat salé, pour l''allergène — pas pour le goût.',
   null, 'une pointe de couteau', 0, 107),
  ('Tofu soyeux', 'autre', 6, true, 'soja', 'Lisse',
   'Une pointe de cuillère mélangée à une purée.',
   'Soja déconseillé comme aliment avant 3 ans (phyto-œstrogènes) : trace seulement.',
   'trace', 0, 108),
  ('Farine infantile avec gluten', 'autre', 6, true, 'gluten', 'Délayée',
   'Délayer 1 c. à café dans un biberon, puis 2 c. à café vers 7 mois.',
   null, '1 à 2 c. à café', 0, 109),
  ('Crevette', 'protéine', 8, true, 'fruits de mer', 'Cuite, mixée',
   'Bien cuite, décortiquée, mixée finement.',
   'Provenance d''une zone d''élevage autorisée.', '10 g', 5, 110),
  ('Sarrasin', 'féculent', 8, true, 'sarrasin', 'Bien cuit, mixé',
   'Cuire comme une semoule, mixer.', null, '2 c. à café', 12, 111),
  ('Kiwi', 'fruit', 8, true, 'kiwi', 'Bien mûr, écrasé',
   'Bien mûr, pelé, écrasé à la fourchette. Sans sucre.', null, '½ kiwi', 0, 9),
  -- Cité par le guide Aiguelongue parmi les fruits rouges, absent du catalogue.
  ('Framboise', 'fruit', 4, false, null, 'Écrasée, mixée',
   'Sans sucre. Passer pour retirer les grains si besoin.', null, null, 0, 8)
on conflict (name) where household_id is null do update set
  category             = excluded.category,
  age_introduction_min = excluded.age_introduction_min,
  is_allergen          = excluded.is_allergen,
  allergen_type        = excluded.allergen_type,
  texture              = excluded.texture,
  preparation          = excluded.preparation,
  restrictions         = excluded.restrictions,
  quantite_indicative  = excluded.quantite_indicative,
  cook_minutes         = excluded.cook_minutes,
  intro_order          = excluded.intro_order;

-- Les laitages portent la protéine de lait de vache : c'est l'un des trois
-- allergènes à preuve d'essai randomisé, il ne peut pas rester non signalé.
update public.foods set is_allergen = true, allergen_type = 'lait de vache'
 where household_id is null
   and name in ('Petit-suisse', 'Yaourt bébé', 'Fromage blanc',
                'Fromage à pâte pressée');

-- Ordre de découverte des aliments allergènes : le tri se rabattait jusqu'ici
-- sur une comparaison d'UUID, donc sur un ordre arbitraire et non reproductible.
update public.foods set intro_order = 100 where household_id is null and name = 'Beurre de cacahuète';
update public.foods set intro_order = 112 where household_id is null and name = 'Œuf dur';
update public.foods set intro_order = 113 where household_id is null and name = 'Poisson blanc';
update public.foods set intro_order = 114 where household_id is null and name = 'Poisson gras (sardine, maquereau)';

-- Les trois légumes à goût fort ne figurent pas dans la liste de démarrage du
-- guide : ils attendent que le répertoire soit installé.
update public.foods set age_introduction_min = 6
 where household_id is null and name in ('Chou', 'Navet', 'Fenouil');

-- Dose prescrite pour cet aliment dans ce repas. Renseignée pour les allergènes
-- (« une pointe de cuillère », puis « 2 c. à café ») : sans elle, le protocole
-- de montée de dose ne serait pas transmis au parent.
alter table public.meal_items
  add column if not exists dose text;

-- Résolution du lien aliment → allergène (une fois les deux catalogues à jour).
update public.foods f
   set allergen_id = a.id
  from public.allergens a
 where f.allergen_type is not null
   and a.household_id is null
   and lower(a.name) = lower(f.allergen_type);
