-- ============================================================================
-- Petite Cuillère — Réaction à un allergène connue au démarrage
-- ============================================================================
-- Lors de l'onboarding, si la diversification a déjà commencé, on demande à quels
-- allergènes l'enfant a été exposé et si une réaction a suivi (oui/non, jamais
-- laquelle — cf. docs/ux-redesign.md §3.4). On enregistre ce booléen pour le
-- tableau de bord de sécurité des allergènes.
-- ============================================================================

alter table public.allergen_introductions
  add column if not exists had_reaction boolean not null default false;

comment on column public.allergen_introductions.had_reaction is
  'Une réaction a-t-elle été observée lors d''une exposition connue (oui/non) ?';
