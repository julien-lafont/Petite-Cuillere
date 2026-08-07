-- ============================================================================
-- Petite Cuillère — méthode de cuisson, préparation d'accueil, service à part
-- ============================================================================
-- Le pas-à-pas (src/lib/recipe.ts) traitait le repas comme une assiette unique :
-- une cuisson vapeur commune calée sur le temps le plus long, un seul mixage.
-- Trois erreurs en découlaient, toutes visibles sur un déjeuner ordinaire
-- « courge · œuf dur · pêche » :
--
--   1. l'œuf dur repartait à la vapeur alors qu'il est déjà cuit ;
--   2. la pêche cuisait avec la courge, mélangeant un fruit et un légume ;
--   3. tout finissait dans le même mixage, au lieu d'une purée salée et d'une
--      compote — deux préparations, mangées l'une après l'autre.
--
-- Le code ne peut pas deviner ces trois choses depuis `category` : un féculent
-- se cuit tantôt à la vapeur (pomme de terre) tantôt à l'eau (riz), un laitier
-- se sert nature quand un fruit se mixe. Elles rejoignent donc le catalogue.
--
--   · cook_method  — 'vapeur' | 'eau' | 'aucune'
--   · course       — 'salé' | 'sucré' | NULL (ni l'un ni l'autre : se sert seul)
--   · served_apart — se sert tel quel, jamais mixé avec le reste
--
-- CONVENTION `prep_note`, qui change pour les cuissons à l'eau :
--   vapeur / aucune → le geste **préalable** seul ; le code ajoute la cuisson.
--   eau             → la phrase **complète**, durée et « à part » comprises ;
--                     le code n'ajoute aucune cuisson par-dessus. C'est ce qui
--                     empêche l'œuf dur d'être cuit deux fois.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

alter table public.foods
  add column if not exists cook_method text,
  add column if not exists course text,
  add column if not exists served_apart boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'foods_cook_method_check') then
    alter table public.foods add constraint foods_cook_method_check
      check (cook_method is null or cook_method in ('vapeur', 'eau', 'aucune'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'foods_course_check') then
    alter table public.foods add constraint foods_course_check
      check (course is null or course in ('salé', 'sucré'));
  end if;
end $$;

comment on column public.foods.cook_method is
  'Mode de cuisson : vapeur (cuisson commune du repas), eau (à part, prep_note porte alors la cuisson entière), aucune.';
comment on column public.foods.course is
  'Préparation d''accueil : salé, sucré, ou NULL quand l''aliment se sert seul (laitage, croûte de pain).';
comment on column public.foods.served_apart is
  'Se sert tel quel, à côté — jamais mixé dans une préparation.';

-- ----------------------------------------------------------------------------
-- 1. Méthode de cuisson
-- ----------------------------------------------------------------------------
-- Défaut déduit de `cook_minutes`, puis les exceptions nommées. Les aliments du
-- catalogue commun ET ceux des foyers en bénéficient : un aliment ajouté à la
-- main par un parent n'a pas de raison d'être moins bien traité.
update public.foods set cook_method = case
  when coalesce(cook_minutes, 0) > 0 then 'vapeur'
  else 'aucune'
end;

-- Les cuissons à l'eau : elles se font à part, dans leur casserole.
update public.foods set cook_method = 'eau'
where household_id is null
  and name in ('Œuf dur', 'Riz', 'Pâtes', 'Semoule', 'Lentilles',
               'Pois chiches', 'Sarrasin');

-- ----------------------------------------------------------------------------
-- 2. Préparation d'accueil
-- ----------------------------------------------------------------------------
update public.foods set course = case
  when category = 'fruit' then 'sucré'
  when category in ('légume', 'protéine', 'féculent', 'matière grasse') then 'salé'
  else null
end;

-- Les deux doses qui n'ont de sens que dans un plat salé. Le reste des additifs
-- (purées d'oléagineux, beurre de cacahuète) garde `course` NULL : le code les
-- délaie dans la compote quand il y en a une — le sucré masque l'amertume.
update public.foods set course = 'salé'
where household_id is null and name in ('Moutarde', 'Tofu soyeux');

-- L'avocat est rangé en légume (cf. 0018) : il tombe donc au salé, comme voulu.

-- ----------------------------------------------------------------------------
-- 3. Ce qui se sert à part
-- ----------------------------------------------------------------------------
-- Un laitage se donne nature à côté de la compote : le mélanger masquerait le
-- goût du fruit seul. Le pain se mâchouille en croûte. La farine infantile va
-- dans un biberon. Le miel est interdit avant 12 mois et n'entre nulle part.
update public.foods set served_apart = (
  category = 'laitier'
  or (household_id is null and name in ('Pain', 'Farine infantile avec gluten', 'Miel'))
);

-- ----------------------------------------------------------------------------
-- 4. `prep_note` des cuissons à l'eau — la phrase entière, cuisson comprise
-- ----------------------------------------------------------------------------
-- Ces notes disaient jusqu'ici un geste préalable auquel le code ajoutait
-- « mets X à cuire à la vapeur ». Elles portent maintenant la cuisson elle-même,
-- et le code n'en ajoute plus.
update public.foods set prep_note = 'Cuis-le dur à part, 10 min à l''eau bouillante, puis écale-le — jaune et blanc'
  where household_id is null and name = 'Œuf dur';
update public.foods set prep_note = 'Rince-le, puis cuis-le à part 20 min dans un grand volume d''eau, bien tendre'
  where household_id is null and name = 'Riz';
update public.foods set prep_note = 'Choisis de petites formes et cuis-les à part 10 min à l''eau, bien tendres'
  where household_id is null and name = 'Pâtes';
update public.foods set prep_note = 'Verse-la en pluie dans un volume égal d''eau chaude et laisse-la gonfler 5 min, à part'
  where household_id is null and name = 'Semoule';
update public.foods set prep_note = 'Rince-les, puis cuis-les à part 25 min à l''eau, bien tendres'
  where household_id is null and name = 'Lentilles';
update public.foods set prep_note = 'En conserve : rince-les, retire les peaux et réchauffe-les à part 10 min à l''eau'
  where household_id is null and name = 'Pois chiches';
update public.foods set prep_note = 'Rince-le, puis cuis-le à part 12 min à l''eau, bien tendre'
  where household_id is null and name = 'Sarrasin';

-- ----------------------------------------------------------------------------
-- 5. `prep_note` des doses délayées — le code y ajoute « dans la compote »
-- ----------------------------------------------------------------------------
-- Elles disaient « délaie dans une compote ou une purée » : le repas est connu
-- au moment d'écrire la recette, l'hésitation n'a plus lieu d'être. Les mises en
-- garde (« jamais de fruit à coque entier ») vivent déjà dans `restrictions`,
-- affichée en propre sur la fiche — les répéter ici alourdissait la phrase.
update public.foods set prep_note = 'Délaie une pointe'
  where household_id is null and name in
    ('Purée de noisette', 'Purée d''amande', 'Purée de noix de cajou',
     'Purée de pistache', 'Purée de noix', 'Purée de sésame (tahini)');
update public.foods set prep_note = 'Délaie une pointe'
  where household_id is null and name = 'Beurre de cacahuète';
update public.foods set prep_note = 'Mélange une pointe de couteau'
  where household_id is null and name = 'Moutarde';
update public.foods set prep_note = 'Écrase une pointe'
  where household_id is null and name = 'Tofu soyeux';

-- ----------------------------------------------------------------------------
-- 6. `prep_note` des aliments crus incorporés — ils rejoignent le mixage
-- ----------------------------------------------------------------------------
-- Le jambon et l'avocat n'étaient jamais rattachés à rien : leur geste
-- s'affichait, puis la recette les oubliait. Ils entrent maintenant dans le
-- mixage de leur préparation, et leur note redevient un simple geste.
update public.foods set prep_note = 'Découenne-le et retire le gras — il est déjà cuit'
  where household_id is null and name = 'Jambon blanc';
