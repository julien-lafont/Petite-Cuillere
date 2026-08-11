-- ============================================================================
-- Petite Cuillère — « Divers » n'est pas une catégorie
-- ============================================================================
-- La liste de courses rangeait onze aliments sous « Divers » : les sept purées
-- d'oléagineux, la moutarde, le miel, le tofu soyeux et la farine infantile.
-- Un rayon fourre-tout est le seul du magasin qu'on ne sait pas parcourir.
--
-- Sauf que `category = 'autre'` ne disait pas « divers ». Il disait, dans le
-- code, **deux** choses à la fois :
--
--   1. le rayon où ranger l'aliment (ce que le parent lit) ;
--   2. « ceci est une dose posée sur un repas, pas un aliment du repas » —
--      c'est ainsi que `recipe.ts` la délayait dans une préparation existante
--      et que `plan.ts` s'autorisait à en poser plusieurs le même jour.
--
-- Les deux sens ne se séparent pas en renommant. D'où cette migration en deux
-- temps : la seconde information sort dans une colonne à elle (`dose_only`,
-- même mouvement que `cook_method` / `course` / `served_apart` en 0019), et la
-- catégorie redevient ce qu'elle prétend être — un rayon.
--
-- Le découpage, côté catalogue :
--
--   oléagineux   ← beurre de cacahuète + les six purées          (7 aliments)
--   condiment    ← moutarde, miel + herbes fraîches, épices douces (4)
--   céréale      ← semoule, riz, pâtes, pain, sarrasin, farine     (6)
--   légumineuse  ← lentilles, pois chiches, tofu soyeux            (3)
--   féculent     ← ce qu'il en reste : pomme de terre, patate douce
--
-- `féculent` garde sa clé mais s'affiche « Tubercules » : c'est aussi le nom du
-- créneau que le générateur emploie, et céréales comme légumineuses s'y ramènent
-- (`slotGroupOf`, src/lib/categories.ts). Sans ce repli, un déjeuner à six mois
-- recevrait un riz **et** des lentilles **et** une pomme de terre.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. La dose, sortie de la catégorie
-- ----------------------------------------------------------------------------
-- Le repli initial reproduit exactement l'ancien comportement : tout ce qui est
-- aujourd'hui en « autre » est une dose, y compris dans les catalogues de foyer.
-- C'est seulement après ce backfill que les catégories peuvent bouger.

alter table public.foods
  add column if not exists dose_only boolean not null default false;

comment on column public.foods.dose_only is
  'Se pose sur un repas sans y prendre de place : une pointe de moutarde, une '
  'cuillère de purée de sésame, une farine délayée au biberon. Le générateur ne '
  'le propose jamais en découverte et n''occupe aucun créneau avec.';

update public.foods set dose_only = true where category = 'autre';

-- ----------------------------------------------------------------------------
-- 2. Le découpage
-- ----------------------------------------------------------------------------
-- Par nom, comme toutes les migrations de catalogue : les aliments propres à un
-- foyer ne sont pas touchés. Un parent qui a rangé sa recette en « Divers » la
-- retrouve en « Divers » — c'est son classement, pas le nôtre.

update public.foods set category = 'oléagineux'
where household_id is null
  and name in ('Beurre de cacahuète', 'Purée de noisette', 'Purée d''amande',
               'Purée de sésame (tahini)', 'Purée de noix de cajou',
               'Purée de pistache', 'Purée de noix');

update public.foods set category = 'condiment'
where household_id is null and name in ('Moutarde', 'Miel');

update public.foods set category = 'céréale'
where household_id is null
  and name in ('Semoule', 'Riz', 'Pâtes', 'Pain', 'Sarrasin',
               'Farine infantile avec gluten');

update public.foods set category = 'légumineuse'
where household_id is null and name in ('Lentilles', 'Pois chiches', 'Tofu soyeux');

-- Les onze doses, nommées. Le backfill du 1. les a déjà marquées ; cette
-- répétition n'existe que pour une seconde exécution, où plus personne n'est en
-- « autre » et où le backfill ne trouverait plus rien à faire.
update public.foods set dose_only = true
where household_id is null
  and name in ('Beurre de cacahuète', 'Purée de noisette', 'Purée d''amande',
               'Purée de sésame (tahini)', 'Purée de noix de cajou',
               'Purée de pistache', 'Purée de noix', 'Moutarde', 'Miel',
               'Tofu soyeux', 'Farine infantile avec gluten');

-- ----------------------------------------------------------------------------
-- 3. Les deux aliments qui manquaient aux condiments
-- ----------------------------------------------------------------------------
-- Le PNNS 4 est explicite : on ne sale pas les plats d'un nourrisson, on les
-- parfume. Herbes et épices douces étaient pourtant absentes du catalogue, donc
-- absentes de la page « Aliments » et de tout suivi de goût — alors qu'elles
-- sont, avec le sucre, ce qu'un parent se demande le plus souvent s'il a le
-- droit d'ajouter.
--
-- Ce sont des doses (`dose_only`) : jamais planifiées d'office, jamais un repas
-- à elles seules. Elles se déclarent goûtées comme le reste.
--
-- `on conflict` s'appuie sur foods_common_name_key (index unique partiel sur
-- name where household_id is null, posé en 0016).

insert into public.foods
  (name, category, age_introduction_min, is_allergen, allergen_type,
   texture, preparation, restrictions, quantite_indicative)
values
  ('Herbes fraîches', 'condiment', 6, false, null,
   'Ciselées très fin',
   'Persil, basilic, ciboulette, coriandre — ciselés très fin et ajoutés hors du feu, une pincée à la fois. C''est ce qui remplace le sel : un plat parfumé se refuse moins qu''un plat fade.',
   null,
   'une pincée'),
  ('Épices douces', 'condiment', 6, false, null,
   'En poudre, une pincée',
   'Cannelle, cumin, curcuma, vanille — une pincée mélangée à la compote ou à la purée. Douces, jamais piquantes : ni piment, ni poivre, ni mélanges du commerce qui contiennent du sel.',
   null,
   'une pincée')
on conflict (name) where household_id is null do update set
  category             = excluded.category,
  age_introduction_min = excluded.age_introduction_min,
  is_allergen          = excluded.is_allergen,
  allergen_type        = excluded.allergen_type,
  texture              = excluded.texture,
  preparation          = excluded.preparation,
  restrictions         = excluded.restrictions,
  quantite_indicative  = excluded.quantite_indicative;

-- Aucune saison : ce sont des placards, et les herbes se trouvent toute l'année.
update public.foods set season = null
  where household_id is null and name in ('Herbes fraîches', 'Épices douces');

-- Ni cuisson ni ordre de découverte : une dose ne se découvre pas, elle
-- accompagne. `intro_order` reste NULL, comme pour les purées d'oléagineux.
update public.foods set
  dose_only    = true,
  cook_minutes = 0,
  cook_method  = 'aucune',
  served_apart = false,
  portion_label = 'une pincée',
  portion_grams = null
where household_id is null and name in ('Herbes fraîches', 'Épices douces');

-- Les herbes vont au salé ; les épices douces gardent `course` NULL, ce qui les
-- envoie d'abord dans la compote (cf. `recipe.ts`) — la cannelle sur une pomme
-- avant le cumin sur une carotte.
update public.foods set
  course    = 'salé',
  prep_note = 'Cisèle-en une pincée et mélange-la hors du feu, en fin de préparation'
where household_id is null and name = 'Herbes fraîches';

update public.foods set
  course    = null,
  prep_note = 'Ajoutes-en une pincée en fin de préparation, sans jamais saler'
where household_id is null and name = 'Épices douces';

-- ----------------------------------------------------------------------------
-- 4. Vérification
-- ----------------------------------------------------------------------------
-- Le catalogue commun ne doit plus contenir aucun « autre », et chaque nouvelle
-- catégorie doit tenir ses trois aliments :
--
--   select category, count(*) from public.foods
--   where household_id is null group by category order by 2 desc;
