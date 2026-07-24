-- ============================================================================
-- Petite Cuillère — Pronom de l'enfant
-- ============================================================================
-- On demande le pronom (et non le « genre ») pour parler de l'enfant avec les
-- bons mots partout dans l'app : « elle », « il » ou « iel ». La valeur stockée
-- est la clé du pronom ; le rendu des phrases vit côté application
-- (`src/lib/pronoun.ts`).
--
-- Volontairement sans contrainte CHECK — même philosophie que `avatar_color` :
-- l'ensemble des pronoms peut s'enrichir côté produit, et une valeur inconnue
-- retombe sur le neutre via `resolvePronoun`. NULL = profils créés avant cette
-- fonctionnalité → traités au neutre (« iel »), sans reformulation genrée.
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

alter table public.babies
  add column if not exists pronoun text;

comment on column public.babies.pronoun is
  'Clé du pronom de l''enfant (elle, il, iel). NULL = neutre par défaut.';
