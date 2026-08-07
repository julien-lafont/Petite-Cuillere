-- ============================================================================
-- Baby Food Tracker — Le réel des repas (suivi & rattrapage)
-- ============================================================================
-- Voir docs/feats/suivi-reel-et-rattrapage.md.
--
-- Une ligne `meals` était à la fois la prévision et le journal. Elle gagne un
-- STATUT : le programme écrit `prevu`, le parent écrit ce qui s'est réellement
-- passé, et le moteur de replanification lit la différence.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

alter table public.meals
  -- Ce qui s'est réellement passé. 'prevu' = aucun signal du parent (défaut).
  --   servi     — donné, composition conforme au programme
  --   remplace  — donné, mais autre chose
  --   saute     — pas donné du tout
  add column if not exists status text not null default 'prevu'
    check (status in ('prevu', 'servi', 'remplace', 'saute')),
  -- Horodatage du signal. Fait foi en cas de saisies concurrentes entre aidants.
  add column if not exists logged_at timestamptz,
  -- Un repas composé ou corrigé par le parent n'est jamais réécrit par le
  -- moteur : il devient une contrainte du plan, pas une variable.
  add column if not exists locked boolean not null default false,
  -- Ce que le programme avait prévu avant correction. Trace d'affichage
  -- (« prévu → réel »), volontairement dénormalisée : jamais une source de
  -- vérité pour un calcul.
  add column if not exists planned_food_ids uuid[];

comment on column public.meals.status is
  'prevu (aucun signal) / servi / remplace / saute. Un repas saute est ignoré de tous les calculs d''exposition.';
comment on column public.meals.locked is
  'Repas fixé par le parent : le moteur de replanification ne le réécrit jamais.';

alter table public.meal_items
  add column if not exists source text not null default 'programme'
    check (source in ('programme', 'parent')),
  -- Granularité fine : « la purée oui, la cuillère d'œuf non ». Sert le
  -- protocole allergènes, où la confirmation d'exposition est une donnée de
  -- sécurité et non un détail d'affichage.
  add column if not exists skipped boolean not null default false;

comment on column public.meal_items.skipped is
  'Cet aliment précis n''a pas été donné, alors que le reste du repas l''a été.';

-- Le rattrapage cherche les repas passés restés sans signal, par enfant.
create index if not exists meals_baby_status_date_idx
  on public.meals (baby_id, status, date);

-- ----------------------------------------------------------------------------
-- Reprise de l'existant
-- ----------------------------------------------------------------------------
-- Un repas déjà noté a forcément eu lieu : il devient `servi`. Tout le reste
-- demeure `prevu` — l'asymétrie de confiance (présumé fait pour le goût, à
-- confirmer pour les allergènes) se joue à la lecture, pas ici.
update public.meals
   set status = 'servi',
       logged_at = coalesce(logged_at, created_at)
 where result is not null
   and status = 'prevu';
