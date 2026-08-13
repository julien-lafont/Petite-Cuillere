import { createClient } from "@/lib/supabase/server";
import { resolveModel } from "@/lib/voice/providers";
import { transcriptionMode } from "@/lib/voice/transcribe";
import { APP_VERSION } from "@/lib/version";

/**
 * `POST /api/voix/trace` — garder la mesure d'une dictée, et rien d'autre.
 *
 * Les latences étaient déjà mesurées : chacune des trois routes du vocal finit
 * sur un `console.info`. Aucune n'était lisible pour autant — l'hébergeur garde
 * les journaux d'exécution une heure sur son offre gratuite, et les exports
 * commencent au palier au-dessus. Cette route est ce qui manquait entre les deux.
 *
 * **Elle est appelée par le navigateur, une fois la carte affichée**, et c'est
 * la seule façon d'obtenir le nombre qui compte : le budget de §3.4 part de la
 * fin de la parole et traverse deux allers-retours réseau, qu'aucune horloge
 * serveur ne voit. Les durées serveur, elles, font l'aller-retour — mesurées
 * ici, renvoyées au navigateur, et relayées par lui.
 *
 * Ce que le navigateur dit n'est donc pas vérifiable, et n'a pas à l'être : ce
 * sont des mesures, pas des droits. Chaque nombre est borné, et une valeur hors
 * bornes devient `null` plutôt que de faire échouer l'écriture — une trace
 * fausse pollue une moyenne, une trace refusée efface la dictée entière.
 *
 * Le modèle et le régime, en revanche, ne sont **jamais** lus dans le corps :
 * ils se relisent dans l'environnement, exactement comme la route de
 * compréhension les a lus une seconde plus tôt. C'est gratuit, ça ne se trompe
 * pas, et ça évite d'annoncer au navigateur le nom du modèle qu'on utilise.
 *
 * Rien de ce qui est écrit ici ne décrit un enfant ni un repas : des durées, des
 * volumes, un nom de modèle. C'est ce qui permet à la mesure de survivre aux
 * trente jours que §7 accorde à une transcription.
 */

/** Deux minutes : au-delà, ce n'est plus une latence, c'est une horloge fausse. */
const MAX_MS = 120_000;

function bounded(value: unknown, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > max) return null;
  return Math.round(value);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response(null, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    const { data: householdId } = await supabase.rpc("current_household_id");
    const model = resolveModel();

    const { error } = await supabase.from("voice_traces").insert({
      household_id: householdId,
      // Une phrase tapée passe par la même compréhension, sans micro : elle
      // compte dans les usages, et sa latence n'est comparable qu'à elle-même.
      mode: body.typed === true ? "typed" : transcriptionMode(),
      model_id: model.id,
      effort: model.effort,
      app_version: APP_VERSION || null,
      speech_ms: bounded(body.speechMs, MAX_MS),
      transcription_ms: bounded(body.transcriptionMs, MAX_MS),
      understanding_ms: bounded(body.understandingMs, MAX_MS),
      route_ms: bounded(body.routeMs, MAX_MS),
      perceived_ms: bounded(body.perceivedMs, MAX_MS),
      audio_kb: bounded(body.audioKb, 8192),
      transcript_length: bounded(body.transcriptLength, 10_000),
      cache_read_tokens: bounded(body.cacheRead, 10_000_000),
      intents: bounded(body.intents, 100),
    });
    if (error) throw error;
  } catch (error) {
    // Une mesure perdue n'est pas un incident : la dictée du parent est déjà
    // affichée, et rien à l'écran ne dépend de cette écriture.
    console.error("voice/trace:", error);
  }

  return new Response(null, { status: 204 });
}
