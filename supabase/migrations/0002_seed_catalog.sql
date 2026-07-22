-- ============================================================================
-- Baby Food Tracker — Catalogue commun (aliments + allergènes)
-- ============================================================================
-- Données issues de docs/diversification-guide.md (PNNS 4 2022 + ameli + Aiguelongue).
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- Ré-exécutable : on repart d'un catalogue commun propre à chaque exécution.
--
-- ⚠️ Contenu organisationnel, PAS un avis médical.
-- ============================================================================

-- On réinitialise le catalogue commun (household_id null) uniquement.
delete from public.foods where household_id is null;
delete from public.allergens where household_id is null;

-- ----------------------------------------------------------------------------
-- Aliments (household_id omis = null = catalogue commun)
-- ----------------------------------------------------------------------------

insert into public.foods
  (name, category, age_introduction_min, is_allergen, allergen_type, texture, preparation, restrictions, quantite_indicative)
values
  -- Légumes (tous dès 4 mois, PNNS)
  ('Carotte', 'légume', 4, false, null, 'Cuite, finement mixée', 'Vapeur puis mixer. Bio conseillé (nitrates). Un seul légume/jour au début.', null, null),
  ('Haricot vert', 'légume', 4, false, null, 'Cuit, finement mixé', 'Vapeur puis mixer.', null, null),
  ('Courgette', 'légume', 4, false, null, 'Cuite, finement mixée', 'Épépiner, cuire, mixer.', null, null),
  ('Potiron', 'légume', 4, false, null, 'Cuit, finement mixé', 'Vapeur puis mixer.', null, null),
  ('Courge', 'légume', 4, false, null, 'Cuite, finement mixée', 'Vapeur puis mixer.', null, null),
  ('Épinard', 'légume', 4, false, null, 'Cuit, finement mixé', 'Cuire puis mixer. Bio conseillé (nitrates).', null, null),
  ('Blanc de poireau', 'légume', 4, false, null, 'Cuit, finement mixé', 'Cuire puis mixer.', null, null),
  ('Brocoli', 'légume', 4, false, null, 'Cuit, finement mixé', 'Vapeur puis mixer.', null, null),
  ('Panais', 'légume', 4, false, null, 'Cuit, écrasé', 'Vapeur puis écraser.', null, null),
  ('Petits pois', 'légume', 4, false, null, 'Cuits, mixés', 'Cuire, mixer et passer pour retirer les peaux.', null, null),
  ('Chou', 'légume', 4, false, null, 'Cuit, mixé', 'Peut être plus fort en goût : introduire progressivement.', null, null),
  ('Navet', 'légume', 4, false, null, 'Cuit, mixé', 'Vapeur puis mixer.', null, null),
  ('Fenouil', 'légume', 4, false, null, 'Cuit, mixé', 'Vapeur puis mixer.', null, null),
  -- Fruits (tous dès 4 mois, PNNS ; sans sucre ajouté)
  ('Pomme', 'fruit', 4, false, null, 'Cuite, mixée', 'Compote sans sucre. Crue râpée plus tard.', null, null),
  ('Poire', 'fruit', 4, false, null, 'Cuite, mixée', 'Compote sans sucre.', null, null),
  ('Banane', 'fruit', 4, false, null, 'Écrasée', 'Bien mûre, écrasée à la fourchette.', null, null),
  ('Abricot', 'fruit', 4, false, null, 'Cuit, mixé', 'Compote sans sucre.', null, null),
  ('Pêche', 'fruit', 4, false, null, 'Cuite, mixée', 'Compote sans sucre.', null, null),
  ('Fraise', 'fruit', 4, false, null, 'Écrasée', 'Sans sucre. Couper si morceaux.', null, null),
  ('Myrtille', 'fruit', 4, false, null, 'Écrasée, mixée', 'Sans sucre.', null, null),
  -- Protéines animales (dès 4-6 mois ; 1 repas/jour ; 10 g/an d'âge)
  ('Poulet', 'protéine', 4, false, null, 'Cuit, mixé', 'Cuire sans matière grasse, mixer avec des légumes. Bien cuit.', null, '10 g/jour par année d''âge (2 c. à café)'),
  ('Bœuf', 'protéine', 4, false, null, 'Cuit, mixé', 'Riche en fer. Bien cuit, mixé finement.', null, '10 g/jour par année d''âge'),
  ('Jambon blanc', 'protéine', 4, false, null, 'Mixé', 'Découenné, dégraissé, mixé. Reste salé.', null, '10 g/jour par année d''âge'),
  ('Poisson blanc', 'protéine', 4, true, 'poisson', 'Cuit, émietté', 'Maigre (colin, cabillaud, merlan). Vapeur, sans arêtes. Non pané.', 'Limiter thon, espadon (métaux lourds).', '10 g/jour par année d''âge, 1×/sem'),
  ('Poisson gras (sardine, maquereau)', 'protéine', 4, true, 'poisson', 'Cuit, émietté', 'Riche en oméga-3. Bien cuit, sans arêtes.', 'Poisson gras 1×/semaine. Éviter gros prédateurs.', '10 g/jour par année d''âge'),
  ('Œuf dur', 'protéine', 4, true, 'œuf', 'Écrasé', 'Jaune + blanc, bien cuit (dur). ¼ d''œuf ≈ 10 g de viande.', 'Jamais cru ou peu cuit avant 5 ans.', 'commencer petit'),
  -- Produits laitiers
  ('Petit-suisse', 'laitier', 5, false, null, 'Lisse', 'Préférer les laitages bébé (lait 2e âge).', null, null),
  ('Yaourt bébé', 'laitier', 6, false, null, 'Lisse', 'Préférer les laitages bébé.', null, null),
  ('Fromage blanc', 'laitier', 6, false, null, 'Lisse', 'Préférer les laitages bébé.', null, null),
  ('Fromage à pâte pressée', 'laitier', 9, false, null, 'Râpé/petits morceaux', 'Vers 9 mois (gruyère, comté). Cuit à cœur.', 'Fromages au lait cru exclus avant 5 ans (sauf pâtes pressées cuites).', null),
  -- Féculents / céréales (glucides complexes à tous les repas, progressivement)
  ('Semoule', 'féculent', 6, true, 'gluten', 'Fine', 'Gluten introduit progressivement.', null, null),
  ('Riz', 'féculent', 6, false, null, 'Bien cuit, mixé', 'Bien cuire puis mixer.', null, null),
  ('Pâtes', 'féculent', 6, true, 'gluten', 'Bien cuites, coupées', 'Gluten. Bien cuire, couper finement.', null, null),
  ('Pomme de terre', 'féculent', 6, false, null, 'Cuite, écrasée', 'Souvent associée aux légumes.', null, null),
  ('Patate douce', 'féculent', 6, false, null, 'Cuite, écrasée', 'Vapeur puis écraser.', null, null),
  ('Lentilles', 'féculent', 6, false, null, 'Mixées', 'Légumes secs uniquement mixés.', null, null),
  ('Pois chiches', 'féculent', 6, false, null, 'Mixés', 'Légumes secs uniquement mixés.', null, null),
  ('Pain', 'féculent', 6, true, 'gluten', 'Croûte à mâchouiller', 'Croûte de pain dans la main dès 6 mois, sous surveillance. Gluten.', null, null),
  -- Matières grasses (ajout systématique dans les plats salés)
  ('Huile de colza', 'matière grasse', 4, false, null, 'Crue', '1 à 2 c. à café par année d''âge, crue, dans les légumes. Bon équilibre oméga-3/6.', null, '1 à 2 c. à café par année d''âge'),
  ('Huile de noix', 'matière grasse', 4, false, null, 'Crue', 'Crue, alterner avec le colza. Bon équilibre oméga-3/6.', null, null),
  ('Beurre', 'matière grasse', 4, false, null, 'Frais', 'Une noisette, à alterner avec l''huile.', null, null),
  -- Autres / allergènes à introduire tôt
  ('Beurre de cacahuète', 'autre', 4, true, 'arachide', 'Dilué / en poudre', 'Introduire tôt (4-6 mois) en poudre dans compote/yaourt/gâteau, progressivement.', 'Jamais de cacahuète entière avant 3 ans (fausse route).', '2 g puis augmenter'),
  ('Miel', 'autre', 12, false, null, null, 'À réserver après 12 mois.', 'Interdit avant 12 mois (botulisme).', null);

-- ----------------------------------------------------------------------------
-- Allergènes (catalogue commun) — introduction précoce (PNNS : dès 4-6 mois)
-- ----------------------------------------------------------------------------

insert into public.allergens (name, type, intro_window, note)
values
  ('Arachide', 'oléagineux', 'dès 4-6 mois', 'En poudre dans compote/yaourt/gâteau. Jamais entière avant 3 ans.'),
  ('Gluten', 'céréale', 'dès 4-6 mois', 'Dès le début de la diversification, en quantités progressives.'),
  ('Œuf', 'protéine', 'dès 4-6 mois', 'Bien cuit (dur) au début.'),
  ('Poisson', 'protéine', 'dès 4-6 mois', 'Cuit, non pané. Limiter les espèces à métaux lourds.'),
  ('Fruits à coque', 'oléagineux', 'dès 4-6 mois', 'En poudre. Jamais entiers avant 3 ans.'),
  ('Lait de vache', 'protéine', 'dès 4-6 mois', 'Via les laitages bébé.'),
  ('Soja', 'légumineuse', 'dès 4-6 mois', 'Allergène introduit tôt, mais soja aliment déconseillé avant 3 ans (phyto-estrogènes).'),
  ('Fruits de mer', 'protéine', 'dès 4-6 mois', 'Cuits, provenant d''une zone d''élevage autorisée.'),
  ('Sésame', 'graine', 'dès 4-6 mois', 'En purée ou en poudre.');
