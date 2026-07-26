-- ============================================================================
-- Petite Cuillère — Prénom de l'enfant : forme canonique et longueur bornée
-- ============================================================================
-- Le prénom est affiché partout dans l'app, souvent au milieu d'une phrase. Il
-- est désormais enregistré sous une forme unique : une majuscule par composante
-- (« Julien », « Pierre-Henri », « Jean Jacques »), le reste en minuscules, et
-- 50 caractères au maximum. La normalisation est faite par l'application
-- (`src/lib/prenom.ts`) ; la base garantit la borne de longueur.
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

-- Reprise des profils existants. `initcap` applique exactement la règle voulue :
-- il met en majuscule la première lettre de chaque composante, y compris après
-- un tiret ou une apostrophe, et le reste en minuscules.
update public.babies
  set prenom = initcap(regexp_replace(btrim(prenom), '\s+', ' ', 'g'));

-- Les prénoms trop longs sont tronqués plutôt que rejetés : aucun profil ne
-- doit devenir inaccessible parce que sa saisie datait d'avant la contrainte.
update public.babies
  set prenom = btrim(left(prenom, 50))
  where char_length(prenom) > 50;

alter table public.babies
  drop constraint if exists babies_prenom_length_check;
alter table public.babies
  add constraint babies_prenom_length_check
  check (char_length(prenom) between 1 and 50);

comment on column public.babies.prenom is
  'Prénom de l''enfant, forme canonique : une majuscule par composante, 50 caractères max.';
