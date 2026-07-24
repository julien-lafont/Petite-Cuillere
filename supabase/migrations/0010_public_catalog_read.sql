-- ============================================================================
-- Petite Cuillère — Lecture du catalogue commun sans compte
-- ============================================================================
-- L'entrée publique du produit (/decouvrir) calcule le programme de bébé
-- **côté client, sans rien écrire en base** (cf. docs/ux-redesign.md §3.5).
-- Pour cela, un visiteur non connecté doit pouvoir LIRE le catalogue commun
-- d'aliments et d'allergènes.
--
-- Supabase accorde en principe SELECT au rôle `anon` par défaut sur les tables
-- du schéma public, mais on ne veut pas dépendre d'un défaut implicite pour une
-- fonctionnalité visible par tous les visiteurs : on l'écrit noir sur blanc.
--
-- ⚠️ Ceci n'ouvre PAS les données des foyers : la RLS reste active et la policy
-- « read foods » / « read allergens » ne laisse voir que les lignes du catalogue
-- commun (`household_id is null`). Pour un visiteur anonyme,
-- `current_household_id()` vaut null, donc aucune ligne de foyer n'est visible.
-- ============================================================================

grant select on public.foods to anon;
grant select on public.allergens to anon;

-- La policy doit exister et s'appliquer au rôle public (donc à `anon`).
-- On la recrée à l'identique pour garantir l'état, de façon idempotente.
drop policy if exists "read foods" on public.foods;
create policy "read foods" on public.foods
  for select using (
    household_id is null or household_id = public.current_household_id()
  );

drop policy if exists "read allergens" on public.allergens;
create policy "read allergens" on public.allergens
  for select using (
    household_id is null or household_id = public.current_household_id()
  );
