-- ============================================================================
-- Petite Cuillère — Borner les textes libres et la taille d'un catalogue
-- ============================================================================
-- Seul le prénom de l'enfant était borné (0014). Tout le reste — nom d'aliment,
-- préparation, restrictions, libellé de moment, note de repas, prénom d'un
-- membre — est du `text` sans limite, vérifié par un `trim()` et un test de
-- non-vacuité. Postgres accepte 1 Go par valeur.
--
-- Ce que ça coûte : un membre écrit un mégaoctet dans un nom d'aliment, et
-- chaque dictée du foyer le recopie dans le prompt envoyé au modèle — le coût
-- se répète, à sa charge à lui, indéfiniment. Même chose pour le nombre de
-- lignes : rien ne limitait la taille d'un catalogue de foyer, que `catalogBlock`
-- énumère en entier à chaque appel.
--
-- Les bornes sont larges à dessein : la plus serrée dépasse d'un facteur deux la
-- plus longue valeur du catalogue livré. Aucune saisie réelle ne les rencontre.
--
-- Les moments de repas n'ont pas besoin de plafond de lignes : leurs créneaux ne
-- peuvent pas se chevaucher et tiennent dans une journée (0022), ce qui les
-- borne déjà.
--
-- Les mêmes valeurs sont reprises côté application (`src/lib/limits.ts`), qui
-- s'en sert pour dire *quel* champ corriger — ce qu'une violation de contrainte
-- ne sait pas faire.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Longueur des textes libres
-- ----------------------------------------------------------------------------
-- `not valid` partout : la borne vaut pour toute écriture, sans re-valider les
-- lignes déjà là. Une valeur ancienne trop longue ne doit pas faire échouer la
-- migration ; elle sera coupée à la première modification.

alter table public.foods
  drop constraint if exists foods_text_bounds;
alter table public.foods
  add constraint foods_text_bounds check (
    char_length(name) between 1 and 80
    and char_length(coalesce(category, '')) <= 40
    and char_length(coalesce(allergen_type, '')) <= 40
    and char_length(coalesce(texture, '')) <= 60
    and char_length(coalesce(preparation, '')) <= 500
    and char_length(coalesce(restrictions, '')) <= 300
    and char_length(coalesce(quantite_indicative, '')) <= 120
    and char_length(coalesce(prep_note, '')) <= 300
    and char_length(coalesce(portion_label, '')) <= 40
  ) not valid;

alter table public.allergens
  drop constraint if exists allergens_text_bounds;
alter table public.allergens
  add constraint allergens_text_bounds check (
    char_length(name) between 1 and 80
    and char_length(coalesce(type, '')) <= 40
    and char_length(coalesce(intro_window, '')) <= 80
    and char_length(coalesce(note, '')) <= 500
    and char_length(coalesce(restrictions, '')) <= 300
    and char_length(coalesce(starting_dose, '')) <= 120
    and char_length(coalesce(target_dose, '')) <= 120
  ) not valid;

alter table public.meal_moments
  drop constraint if exists meal_moments_label_bounds;
alter table public.meal_moments
  add constraint meal_moments_label_bounds
  check (char_length(label) between 1 and 40) not valid;

alter table public.meals
  drop constraint if exists meals_note_bounds;
alter table public.meals
  add constraint meals_note_bounds
  check (char_length(coalesce(note, '')) <= 1000) not valid;

alter table public.meal_items
  drop constraint if exists meal_items_dose_bounds;
alter table public.meal_items
  add constraint meal_items_dose_bounds
  check (char_length(coalesce(dose, '')) <= 120) not valid;

alter table public.intake_observations
  drop constraint if exists intake_observations_text_bounds;
alter table public.intake_observations
  add constraint intake_observations_text_bounds check (
    char_length(coalesce(effect_type, '')) <= 60
    and char_length(coalesce(severity, '')) <= 60
    and char_length(coalesce(delay, '')) <= 60
    and char_length(coalesce(note, '')) <= 1000
  ) not valid;

alter table public.profiles
  drop constraint if exists profiles_text_bounds;
alter table public.profiles
  add constraint profiles_text_bounds check (
    char_length(coalesce(prenom, '')) <= 50
    and char_length(coalesce(relation, '')) <= 60
  ) not valid;

alter table public.invitations
  drop constraint if exists invitations_text_bounds;
alter table public.invitations
  add constraint invitations_text_bounds check (
    char_length(prenom) between 1 and 50
    and char_length(coalesce(relation, '')) <= 60
  ) not valid;

alter table public.households
  drop constraint if exists households_text_bounds;
alter table public.households
  add constraint households_text_bounds check (
    char_length(name) between 1 and 80
    and char_length(coalesce(timezone, '')) <= 64
  ) not valid;

alter table public.babies
  drop constraint if exists babies_avatar_color_bounds;
alter table public.babies
  add constraint babies_avatar_color_bounds
  check (char_length(coalesce(avatar_color, '')) <= 40) not valid;

-- ----------------------------------------------------------------------------
-- 2. Taille d'un catalogue de foyer
-- ----------------------------------------------------------------------------
-- 500 : le catalogue commun en compte 67, et un foyer qui ajoute ses propres
-- aliments en pose une poignée. La borne n'est pas un chiffre métier, c'est
-- l'ordre de grandeur au-delà duquel la seule explication est une boucle.
--
-- `security definer` : le décompte doit être exact, pas filtré par la RLS de
-- celui qui insère. Les lignes du catalogue commun (`household_id` null) sont
-- posées par les migrations et ne passent pas par ici.

create or replace function public.enforce_household_catalog_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if new.household_id is null then
    return new;
  end if;
  execute format('select count(*) from public.%I where household_id = $1', tg_table_name)
    into v_count using new.household_id;
  if v_count >= 500 then
    raise exception 'catalogue du foyer complet (500 lignes maximum)';
  end if;
  return new;
end;
$$;

drop trigger if exists foods_household_limit on public.foods;
create trigger foods_household_limit
  before insert on public.foods
  for each row execute function public.enforce_household_catalog_limit();

drop trigger if exists allergens_household_limit on public.allergens;
create trigger allergens_household_limit
  before insert on public.allergens
  for each row execute function public.enforce_household_catalog_limit();
