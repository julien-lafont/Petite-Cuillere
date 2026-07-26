-- ============================================================================
-- Petite Cuillère — Sexe de l'enfant (remplace le pronom)
-- ============================================================================
-- L'onboarding demandait un pronom parmi trois valeurs (elle/il/iel). On revient
-- à une question plus simple : « une fille » ou « un garçon ». Le pronom et les
-- accords sont désormais dérivés de cette valeur côté application
-- (`src/lib/sexe.ts`) ; la gestion du neutre est supprimée.
--
-- Reprise des profils existants : « elle » → « fille », « il » → « garcon ».
-- Les anciens profils neutres (« iel ») et ceux jamais renseignés restent NULL
-- — on ne devine pas un sexe à leur place ; l'app retombe sur le masculin pour
-- le rendu, et le parent corrige depuis le profil de l'enfant.
-- À exécuter dans Supabase : SQL Editor → coller → Run.
-- ============================================================================

alter table public.babies
  add column if not exists sexe text;

-- Report des pronoms genrés déjà renseignés (no-op si la colonne a disparu).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'babies'
      and column_name = 'pronoun'
  ) then
    update public.babies
      set sexe = case pronoun
        when 'elle' then 'fille'
        when 'il' then 'garcon'
      end
      where sexe is null;
  end if;
end $$;

alter table public.babies
  drop column if exists pronoun;

-- NULL reste permis : « pas encore renseigné » est un état légitime.
alter table public.babies
  drop constraint if exists babies_sexe_check;
alter table public.babies
  add constraint babies_sexe_check check (sexe in ('fille', 'garcon'));

comment on column public.babies.sexe is
  'Sexe de l''enfant (fille, garcon). NULL = non renseigné → masculin au rendu.';
