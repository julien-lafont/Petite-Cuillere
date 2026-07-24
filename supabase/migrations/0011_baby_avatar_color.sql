-- ============================================================================
-- Petite Cuillère — Couleur de la pastille d'un enfant
-- ============================================================================
-- Chaque enfant est représenté par l'initiale de son prénom dans un cercle
-- coloré. `avatar_color` retient la clé de la teinte choisie (`sauge`,
-- `lavande`, `ocean`…) ; les valeurs réelles vivent dans le design system
-- (variables CSS `--avatar-*`), pas en base.
--
-- Volontairement sans contrainte CHECK : la palette évolue côté produit et une
-- clé inconnue retombe sur la teinte par défaut via `resolveAvatarColor`.
-- NULL = pastille sauge, soit l'apparence historique — les profils existants
-- ne changent donc pas d'aspect.
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

alter table public.babies
  add column if not exists avatar_color text;

comment on column public.babies.avatar_color is
  'Clé de la couleur de pastille (sauge, eucalyptus, ocean…). NULL = teinte par défaut.';
