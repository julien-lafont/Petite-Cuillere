-- ============================================================================
-- Petite Cuillère — Un budget de voix par personne
-- ============================================================================
-- Les trois routes du micro (`/api/voix`, `/api/voix/transcrire`,
-- `/api/voix/ecoute`) vérifient qu'une session existe, et rien d'autre. Chaque
-- appel accepté dépense de l'argent chez un tiers : un appel au modèle pour la
-- première, une transcription Gladia pour les deux autres. Les garde-fous
-- existants (1 000 caractères, 4 Mo d'audio) bornent la taille d'un appel, pas
-- leur nombre.
--
-- Une boucle depuis un compte inscrit — l'inscription est ouverte, le coût
-- d'entrée est une adresse e-mail — dépense donc sans plafond, et occupe au
-- passage les créneaux d'exécution de l'hébergeur : la route pré-enregistrée
-- tient la fonction ouverte jusqu'à 25 secondes en attendant Gladia.
--
-- Le compteur vit en base plutôt qu'en mémoire : les fonctions sont sans état et
-- s'exécutent en parallèle, une variable de module ne compterait rien.
--
-- Deux bornes, parce qu'elles répondent à deux choses différentes :
--   · la journée plafonne la dépense ;
--   · la minute arrête la boucle avant qu'elle ne sature les créneaux.
-- Les deux sont hors d'atteinte d'un parent : dicter un repas coûte deux appels
-- (écouter, puis comprendre), et une journée chargée en compte une dizaine.
--
-- Ce fichier ne remplace pas un plafond de dépense chez chaque fournisseur —
-- c'est lui qui arrête la facture pour de bon. Il évite qu'on en arrive là.
--
-- À exécuter dans Supabase : SQL Editor → coller → Run. Ré-exécutable.
-- ============================================================================

-- Une ligne par personne, réécrite sur place : un compteur par jour laisserait
-- derrière lui une ligne par personne et par jour, pour une donnée dont plus
-- personne ne veut le lendemain.
create table if not exists public.voice_usage (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  day date not null default current_date,
  calls int not null default 0,
  -- Fenêtre courte, à départ fixe : elle repart de zéro une minute après son
  -- premier appel, plutôt que de glisser (ce qui demanderait de garder les
  -- horodatages un par un).
  window_started_at timestamptz not null default now(),
  window_calls int not null default 0
);

-- Aucune politique : la table n'est jamais lue ni écrite par l'API. Elle ne
-- passe que par la fonction ci-dessous, qui appartient à `postgres` et n'est
-- donc soumise ni à la RLS ni aux privilèges de colonne.
alter table public.voice_usage enable row level security;
revoke all on public.voice_usage from anon, authenticated;

comment on table public.voice_usage is
  'Compteur d''appels au micro, par personne. Écrit uniquement par consume_voice_call().';

-- ----------------------------------------------------------------------------
-- Consommer un appel
-- ----------------------------------------------------------------------------
-- Renvoie 'ok', 'burst' (trop d'appels dans la minute) ou 'daily' (budget du
-- jour épuisé) — le refus dit lequel des deux, parce que « réessayez dans un
-- instant » et « réessayez demain » ne sont pas la même phrase.
--
-- Les plafonds sont écrits ici et pas passés en paramètre : la fonction est
-- appelable depuis l'API, un argument serait choisi par l'appelant.
--
-- Un appel refusé compte quand même. Sinon une boucle obtiendrait un appel
-- gratuit à chaque expiration de fenêtre, ce qui est exactement le régime
-- qu'elle cherche.

create or replace function public.consume_voice_call()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_cap constant int := 200;
  burst_cap constant int := 20;
  v_uid uuid := auth.uid();
  v_row public.voice_usage;
begin
  if v_uid is null then
    return 'daily';
  end if;

  insert into public.voice_usage as u
    (profile_id, day, calls, window_started_at, window_calls)
    values (v_uid, current_date, 1, now(), 1)
  on conflict (profile_id) do update set
    day = current_date,
    calls = case when u.day = current_date then u.calls + 1 else 1 end,
    window_started_at = case
      when u.window_started_at > now() - interval '1 minute'
      then u.window_started_at else now() end,
    window_calls = case
      when u.window_started_at > now() - interval '1 minute'
      then u.window_calls + 1 else 1 end
  returning * into v_row;

  if v_row.calls > daily_cap then
    return 'daily';
  end if;
  if v_row.window_calls > burst_cap then
    return 'burst';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.consume_voice_call() from anon;
grant execute on function public.consume_voice_call() to authenticated;
