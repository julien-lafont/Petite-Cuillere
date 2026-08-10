-- ============================================================================
-- Petite Cuillère — consignes de sécurité des allergènes, séparées du reste
-- ============================================================================
-- `allergens.note` mélangeait deux choses qui n'ont ni le même poids ni le même
-- lecteur :
--
--   · une recette — « délayé dans une compote », « en purée (tahini) » ;
--   · une interdiction — « jamais de cacahuète entière avant 3 ans ».
--
-- La première est un conseil : l'ignorer donne un repas moins bon. La seconde
-- est un risque d'étouffement, et la noyer dans la même phrase grise, au même
-- corps, la rend invisible. La page allergènes ne montre plus la recette (le
-- parent a déjà la fiche repas pour ça) mais doit continuer à montrer le danger.
--
-- D'où `restrictions`, du même nom que `foods.restrictions`, qui porte déjà
-- exactement ce contenu (« Interdit avant 12 mois (botulisme). » pour le miel)
-- et s'affiche déjà en rouge avec son triangle. Même concept, même colonne,
-- même rendu.
--
-- Ce qui reste dans `note` : la préparation et les remarques de fond (« groupe
-- distinct de la noisette »). Ce qui passe dans `restrictions` : uniquement ce
-- qui blesse si on l'ignore — étouffement, cru, métaux lourds, phyto-œstrogènes.
-- Les allergènes sans danger propre (gluten, sésame, moutarde, sarrasin, kiwi)
-- gardent `restrictions` à NULL : une consigne de sécurité partout ne se lit
-- plus nulle part.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

alter table public.allergens
  add column if not exists restrictions text;

comment on column public.allergens.restrictions is
  'Consigne de sécurité, et rien d''autre : ce qui blesse l''enfant si on '
  'l''ignore. Affichée en alerte sur la page allergènes. La préparation reste '
  'dans `note`, qui n''est pas affichée là. NULL = pas de danger propre.';

-- ----------------------------------------------------------------------------
-- Catalogue commun : la consigne extraite de `note`, resserrée sur le risque
-- ----------------------------------------------------------------------------
-- Mise à jour par nom, comme partout ailleurs dans les migrations de catalogue.
-- Les allergènes propres à un foyer ne sont pas touchés.

update public.allergens set restrictions = case name
  -- Étouffement : la cause de décès la plus fréquente autour de ces aliments,
  -- très loin devant l'allergie elle-même. L'âge de 3 ans est celui retenu en
  -- France pour les aliments durs et ronds.
  when 'Arachide'      then 'Jamais de cacahuète entière ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Noisette'      then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Amande'        then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Noix de cajou' then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Pistache'      then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'
  when 'Noix'          then 'Jamais de fruit à coque entier ni en morceaux avant 3 ans : risque d''étouffement.'

  -- Cru : salmonelle pour l'œuf, contamination bactérienne pour les fruits de
  -- mer. La cuisson n'est pas ici un choix de goût.
  when 'Œuf'           then 'Jamais cru ni peu cuit avant 5 ans : risque de salmonelle.'
  when 'Fruits de mer' then 'Toujours bien cuits, jamais crus, d''une zone d''élevage autorisée.'

  -- Arêtes (étouffement) et méthylmercure, qui s'accumule chez les prédateurs.
  when 'Poisson'       then 'Sans arêtes. Limiter les gros prédateurs — thon, espadon, requin (métaux lourds).'

  -- Deux consignes qui ne portent pas sur l'allergène mais sur l'aliment : le
  -- goûter en trace est recommandé, en faire un ordinaire ne l'est pas.
  when 'Lait de vache' then 'Le lait de vache en boisson attend 12 mois : avant, laitages bébé uniquement.'
  when 'Soja'          then 'Le soja comme aliment est déconseillé avant 3 ans (phyto-œstrogènes) : une trace suffit.'

  else null
end
where household_id is null;
