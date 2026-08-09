import type { Term } from "@/lib/voice/lexicon";

/**
 * L'adaptateur de transcription — Gladia, dans ses deux régimes (§4.2).
 *
 * Le fournisseur reste derrière une signature : le reste du code n'apprend
 * jamais son nom, et le jour où on en change, c'est ce fichier qu'on réécrit.
 *
 * **Deux régimes coexistent, et on bascule par `VOICE_TRANSCRIPTION`** :
 *
 *   · `pre-recorded` (défaut) — `solaria-3`, le meilleur modèle sur du français
 *     réel, mais qui n'existe qu'en asynchrone. Le navigateur enregistre, envoie
 *     le tout d'un bloc, et le texte arrive une fois la phrase finie ;
 *   · `live` — `solaria-1`, moins précis, mais qui écrit les mots **pendant**
 *     qu'on parle. Le temps de transcription se dissout alors dans le temps de
 *     parole au lieu de s'y ajouter.
 *
 * L'arbitrage n'est donc pas « rapide contre lent » : c'est **la justesse du
 * texte contre le fait de le voir venir**. Les deux se défendent, la mesure
 * tranchera, et la variable existe pour qu'on puisse mesurer sans redéployer.
 *
 * **La clé ne quitte jamais le serveur** (§7), dans les deux régimes. En flux,
 * elle sert à ouvrir une session et Gladia répond par une URL WebSocket à jeton
 * éphémère — c'est elle, pas la clé, que le navigateur reçoit. En asynchrone,
 * l'audio remonte par notre route, qui le repousse chez Gladia.
 */

const LIVE_URL = "https://api.gladia.io/v2/live";
const UPLOAD_URL = "https://api.gladia.io/v2/upload";
const BATCH_URL = "https://api.gladia.io/v2/pre-recorded";

/**
 * §4.2 tranchait pour `solaria-3`, et le choix tient — mais l'API temps réel ne
 * l'accepte pas à ce jour. C'est toute la raison d'être des deux régimes : le
 * jour où `solaria-3` passe en flux, ces deux constantes se rejoignent et la
 * variable d'environnement perd son intérêt.
 */
const LIVE_MODEL = "solaria-1";
const BATCH_MODEL = "solaria-3";

/**
 * Durée de silence qui clôt un énoncé, en secondes. Le défaut (0,05 s) découpe
 * une dictée en miettes ; à 0,3 s, une hésitation au milieu d'une phrase ne la
 * coupe plus en deux, et un vrai point final reste détecté bien avant que notre
 * propre seuil de silence n'arrête le micro.
 */
const ENDPOINTING = 0.3;

export type TranscriptionMode = "live" | "pre-recorded";

/**
 * Le régime en vigueur, lu dans l'environnement.
 *
 * `pre-recorded` par défaut : à qualité de transcription inégale, on prend la
 * meilleure. Une valeur inconnue retombe sur le défaut plutôt que de faire
 * tomber le micro — une faute de frappe dans une variable ne doit pas priver un
 * parent de la fonctionnalité, elle doit se voir dans les journaux.
 */
export function transcriptionMode(): TranscriptionMode {
  const configured = process.env.VOICE_TRANSCRIPTION;
  if (configured === "live" || configured === "pre-recorded") return configured;
  if (configured) {
    console.warn(
      `[voice] VOICE_TRANSCRIPTION="${configured}" inconnu — « pre-recorded » retenu.`,
    );
  }
  return "pre-recorded";
}

/** Les seuls taux d'échantillonnage que l'API accepte. */
const SAMPLE_RATES = [8000, 16000, 32000, 44100, 48000] as const;
export type SampleRate = (typeof SAMPLE_RATES)[number];

export function isSampleRateSupported(value: number): value is SampleRate {
  return (SAMPLE_RATES as readonly number[]).includes(value);
}

export type LiveSession = {
  /** URL WebSocket à usage unique, jeton compris. À ne pas journaliser. */
  url: string;
  id: string;
};

export type LiveSessionInput = {
  /** Prénoms, aliments, allergènes : le lexique du foyer. */
  lexicon: Term[];
  /** Celui du navigateur, tel qu'il l'a réellement obtenu. */
  sampleRate: SampleRate;
};

/** Le service met rarement plus d'une seconde ; au-delà, on rend la main. */
const TIMEOUT_MS = 8000;

/**
 * L'appariement phonétique, ou rien.
 *
 * **Un lexique vide est refusé par l'API** (« must contain at least 1
 * elements »), et le refus tombe à l'ouverture de la session : sans ce garde,
 * un foyer qui vient de s'inscrire — pas encore d'aliment, un prénom de trois
 * lettres — n'aurait jamais de micro du tout. Mieux vaut transcrire sans
 * lexique que ne pas transcrire.
 *
 * L'intensité est le réglage à surveiller (§4.2.2), et il se règle vers le bas.
 * Mesuré sur des dictées réelles, en flux : à 0,5 comme à 0,4, « il a mangé des
 * **poireaux** » revient en « il a mangé des **Poire** » — le moteur remplace un
 * mot juste par un voisin du catalogue. À 0,3, la phrase repasse intacte et les
 * mots rares (« panais », « fenouil ») sont toujours rattrapés.
 *
 * On est donc sous la plage recommandée par la documentation (0,4–0,6), et c'est
 * assumé : elle vise des lexiques de jargon, là où le nôtre est plein de mots
 * français ordinaires — « poire », « pomme », « chou » — qui ressemblent à trop
 * de choses. Un mot rattrapé de moins coûte moins cher qu'un mot juste abîmé.
 *
 * La mesure a été faite sur `solaria-1` ; elle reste à refaire sur `solaria-3`,
 * qui n'a aucune raison d'avoir exactement les mêmes seuils.
 */
function vocabulary(lexicon: Term[]) {
  if (lexicon.length === 0) return { custom_vocabulary: false };
  return {
    custom_vocabulary: true,
    custom_vocabulary_config: {
      default_intensity: 0.3,
      vocabulary: lexicon.map((term) =>
        term.variants || term.intensity
          ? {
              value: term.value,
              ...(term.variants ? { pronunciations: term.variants } : {}),
              ...(term.intensity ? { intensity: term.intensity } : {}),
            }
          : term.value,
      ),
    },
  };
}

function apiKey() {
  const key = process.env.GLADIA_API_KEY;
  if (!key) throw new Error("GLADIA_API_KEY is not configured");
  return key;
}

async function refuse(response: Response): Promise<never> {
  const body = await response.text().catch(() => "");
  throw new Error(`Gladia ${response.status}: ${body.slice(0, 300)}`);
}

// ────────────────────────────────────────────────────────────────────────────
// Le flux (`live`)
// ────────────────────────────────────────────────────────────────────────────

export async function openLiveSession({
  lexicon,
  sampleRate,
}: LiveSessionInput): Promise<LiveSession> {
  const response = await fetch(LIVE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-gladia-key": apiKey() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      encoding: "wav/pcm",
      bit_depth: 16,
      sample_rate: sampleRate,
      channels: 1,
      model: LIVE_MODEL,
      endpointing: ENDPOINTING,
      // Un parent dicte une phrase, pas un monologue : le filet est bas.
      maximum_duration_without_endpointing: 10,
      language_config: { languages: ["fr"], code_switching: false },
      realtime_processing: vocabulary(lexicon),
      messages_config: {
        // Le partiel est toute la raison d'être du temps réel : c'est lui qui
        // s'affiche pendant qu'on parle.
        receive_partial_transcripts: true,
        receive_final_transcripts: true,
        // Le reste est du bruit sur le fil : on tient déjà notre propre niveau
        // sonore, et on n'a rien à faire des événements de cycle de vie.
        receive_speech_events: false,
        receive_pre_processing_events: false,
        receive_realtime_processing_events: false,
        receive_post_processing_events: true,
        receive_acknowledgments: false,
        receive_errors: true,
        receive_lifecycle_events: false,
      },
    }),
  });

  if (!response.ok) await refuse(response);

  const session = (await response.json()) as { id?: string; url?: string };
  if (!session.url) throw new Error("Gladia returned no session URL");
  return { url: session.url, id: session.id ?? "?" };
}

// ────────────────────────────────────────────────────────────────────────────
// L'asynchrone (`pre-recorded`)
// ────────────────────────────────────────────────────────────────────────────

/** La scrutation du résultat : court, parce que le parent attend devant l'écran. */
const POLL_MS = 200;
const POLL_TIMEOUT_MS = 25_000;

export type TranscribeInput = {
  /** Le WAV assemblé par le navigateur, PCM 16 bits mono. */
  audio: Blob;
  lexicon: Term[];
};

/**
 * Trois appels et une attente : on dépose le fichier, on lance le travail, on
 * scrute jusqu'à la réponse.
 *
 * La scrutation plutôt qu'un `callback` est délibérée : une dictée est synchrone
 * du point de vue du parent — il attend devant son écran. Un rappel HTTP nous
 * obligerait à tenir un canal ouvert vers le client pour rien (§4.2.1).
 */
export async function transcribe({
  audio,
  lexicon,
}: TranscribeInput): Promise<string> {
  const key = apiKey();

  const form = new FormData();
  form.append("audio", audio, "dictee.wav");
  const upload = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { "x-gladia-key": key },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!upload.ok) await refuse(upload);
  const { audio_url: audioUrl } = (await upload.json()) as {
    audio_url?: string;
  };
  if (!audioUrl) throw new Error("Gladia returned no audio URL");

  const job = await fetch(BATCH_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-gladia-key": key },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      audio_url: audioUrl,
      model: BATCH_MODEL,
      language_config: { languages: ["fr"], code_switching: false },
      ...vocabulary(lexicon),
      // Un seul locuteur : la diarisation coûterait du temps pour rien.
      diarization: false,
    }),
  });
  if (!job.ok) await refuse(job);
  const { result_url: resultUrl } = (await job.json()) as {
    result_url?: string;
  };
  if (!resultUrl) throw new Error("Gladia returned no result URL");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    const poll = await fetch(resultUrl, {
      headers: { "x-gladia-key": key },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!poll.ok) await refuse(poll);
    const body = (await poll.json()) as {
      status?: string;
      error_code?: unknown;
      result?: { transcription?: { full_transcript?: string } };
    };
    if (body.status === "done") {
      return body.result?.transcription?.full_transcript?.trim() ?? "";
    }
    if (body.status === "error") {
      throw new Error(`Gladia job failed: ${JSON.stringify(body.error_code)}`);
    }
  }
  throw new Error("Gladia job timed out");
}
