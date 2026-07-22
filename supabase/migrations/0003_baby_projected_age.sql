-- ============================================================================
-- Baby Food Tracker — Âge projeté personnalisé (prématurés)
-- ============================================================================
-- `age_reference_date` : date de référence à partir de laquelle l'âge « projeté »
-- est compté. Pour un prématuré, elle est choisie ENTRE la naissance (âge réel)
-- et le terme théorique (âge corrigé). NULL = comportement par défaut
-- (âge corrigé si prématuré, âge réel sinon).
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

alter table public.babies
  add column if not exists age_reference_date date;
