"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceListenReply } from "@/lib/voice/types";

/**
 * La dictée, côté navigateur : du micro à Gladia, en direct.
 *
 * Tout le trajet audio vit ici, et rien d'autre ne vit ici. Le composant
 * d'écoute (`voice-listening.tsx`) ne fait que dessiner ce que ce crochet
 * expose ; il ne sait ni ce qu'est une trame PCM ni qu'il existe un WebSocket.
 *
 * Le trajet, dans l'ordre :
 *
 *   1. **le micro d'abord.** C'est la seule étape où le parent a quelque chose
 *      à faire, et la seule qui peut être refusée. Les barres bougent dès
 *      qu'elle réussit — avant même qu'on sache comment on va transcrire ;
 *   2. **le régime ensuite** (`POST /api/voix/ecoute`), pendant que le micro
 *      tourne déjà. Les trames enregistrées entre-temps sont mises de côté ;
 *   3. **et selon la réponse** : soit le flux, et la file part d'un bloc dans la
 *      liaison qui vient de s'ouvrir, soit l'attente, et les trames s'empilent
 *      jusqu'au dernier mot avant de partir en un seul envoi.
 *
 * La file d'attente est ce qui rend cet ordre supportable : sans elle, la
 * seconde qui sépare l'appui du parent de la réponse du serveur serait une
 * seconde de parole perdue — et personne ne recommence une phrase deux fois.
 *
 * **Une seule capture pour les deux régimes.** Le fil audio produit du PCM 16
 * bits, que le flux consomme trame par trame et que l'asynchrone empaquette en
 * WAV à la fin. C'est ce qui permet au niveau sonore, à la détection de silence
 * et au chronomètre d'être exactement les mêmes des deux côtés.
 *
 * Où va l'audio, en revanche, diffère : en flux il va du navigateur à Gladia
 * sans nous, en asynchrone il remonte par notre route (§7).
 *
 * En développement, le mode strict de React monte l'effet deux fois : deux
 * sessions sont donc ouvertes par dictée, dont la première est refermée aussitôt.
 * C'est attendu, et ça ne se produit pas en production.
 */

/** Une seconde et quart tient dans la barre : 32 trames à 25 par seconde. */
const BARS = 32;
/** En dessous, on considère que le parent s'est tu. Mesuré, pas deviné. */
const SILENCE_LEVEL = 0.05;
const SILENCE_MS = 3000;
/** Filet de sécurité : une dictée fait 8 secondes, jamais une minute. */
const MAX_MS = 45_000;
/**
 * Après « j'ai fini de parler », on laisse au moteur le temps de rendre sa
 * copie. Au-delà, on se contente de ce qui est déjà acquis : mieux vaut une
 * phrase à relire qu'un écran qui attend.
 */
const WRAP_UP_MS = 2500;
/**
 * Le gain est calé sur une voix qui parle à un téléphone posé sur le plan de
 * travail, pas sur un micro de studio : sans lui, une phrase normale ne décolle
 * pas du repos et le parent croit ne pas être entendu.
 */
const GAIN = 5.5;
/**
 * Plafond des trames gardées, en nombre. Il couvre toute la dictée, parce qu'en
 * régime asynchrone c'est l'enregistrement entier qu'on garde — soit trente
 * secondes à vingt-cinq trames par seconde, plus une marge d'une seconde.
 */
const MAX_FRAMES = Math.ceil((MAX_MS / 1000) * 25) + 25;

/**
 * L'encodeur, exécuté dans le fil audio.
 *
 * Il fait deux choses d'un coup, parce qu'il a déjà les échantillons sous la
 * main : il convertit en PCM 16 bits — le seul format que l'API accepte — et il
 * mesure l'énergie de la trame. Le niveau affiché à l'écran est donc celui de
 * l'audio réellement envoyé, pas celui d'une seconde mesure faite à côté.
 */
const ENCODER = `
class PcmEncoder extends AudioWorkletProcessor {
  constructor() {
    super();
    // ~40 ms par trame : assez court pour que la transcription suive la voix,
    // assez long pour ne pas inonder la liaison.
    this.size = Math.round(sampleRate / 25);
    this.frame = new Int16Array(this.size);
    this.filled = 0;
    this.energy = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i += 1) {
      const sample = Math.max(-1, Math.min(1, channel[i]));
      this.energy += sample * sample;
      this.frame[this.filled] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.filled += 1;
      if (this.filled === this.size) {
        const pcm = this.frame.slice().buffer;
        this.port.postMessage(
          { pcm: pcm, level: Math.sqrt(this.energy / this.size) },
          [pcm],
        );
        this.filled = 0;
        this.energy = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-encoder", PcmEncoder);
`;

export type DictationPhase = "starting" | "listening" | "wrapping" | "failed";

/**
 * Le régime, tel que le serveur l'a annoncé. Tant qu'il n'a pas répondu, on
 * enregistre sans savoir : les trames s'empilent, et elles serviront de toute
 * façon — poussées d'un bloc dans la session en flux, ou gardées pour l'envoi.
 */
export type DictationMode = "live" | "pre-recorded" | "unknown";

export type Dictation = {
  phase: DictationPhase;
  /** Ce que l'écran doit promettre : du texte pendant, ou du texte après. */
  mode: DictationMode;
  /** Historique du niveau sonore, du plus ancien au plus récent, de 0 à 1. */
  levels: number[];
  seconds: number;
  /** Ce qui est acquis : le moteur ne le remettra plus en cause. */
  text: string;
  /** L'hypothèse en cours, encore révisable au mot près. */
  partial: string;
  /** Renseigné en phase « failed », et écrit pour le parent. */
  error: string | null;
  /** Le micro a été refusé : ce n'est pas une panne, on ne propose pas de réessayer. */
  denied: boolean;
  /** « J'ai fini de parler. » Sans effet si l'écoute est déjà close. */
  stop: () => void;
};

function trim(parts: string[]) {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Les trames, enveloppées dans un WAV.
 *
 * Quarante-quatre octets d'en-tête, et c'est tout : le PCM que le fil audio
 * produit est déjà celui qu'un WAV contient. On aurait pu passer par
 * `MediaRecorder`, mais il rend du webm chez les uns et du mp4 chez les autres
 * — et l'un de ces autres est Safari sur iPhone, c'est-à-dire la plateforme
 * cible. Un seul chemin de capture pour les deux régimes vaut mieux que deux.
 */
function toWav(frames: ArrayBuffer[], sampleRate: number): Blob {
  const bytes = frames.reduce((total, frame) => total + frame.byteLength, 0);
  const header = new DataView(new ArrayBuffer(44));
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) {
      header.setUint8(offset + i, text.charCodeAt(i));
    }
  };
  ascii(0, "RIFF");
  header.setUint32(4, 36 + bytes, true);
  ascii(8, "WAVEfmt ");
  header.setUint32(16, 16, true); // taille du bloc « fmt »
  header.setUint16(20, 1, true); // PCM entier
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true); // octets par seconde
  header.setUint16(32, 2, true); // octets par échantillon
  header.setUint16(34, 16, true); // bits par échantillon
  ascii(36, "data");
  header.setUint32(40, bytes, true);
  return new Blob([header.buffer, ...frames], { type: "audio/wav" });
}

export function useDictation({
  onDone,
}: {
  /** La phrase finale, une seule fois, et seulement si elle contient quelque chose. */
  onDone: (text: string) => void;
}): Dictation {
  const [phase, setPhase] = useState<DictationPhase>("starting");
  const [mode, setMode] = useState<DictationMode>("unknown");
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [seconds, setSeconds] = useState(0);
  const [text, setText] = useState("");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  /*
   * `onDone` passe par une ref, et l'écoute ne dépend de rien : sans ça, un
   * simple rendu du parent — il en survient pour mille raisons — changerait
   * l'identité du rappel, relancerait l'effet, et couperait le micro au milieu
   * d'une phrase.
   */
  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  });

  const closer = useRef<() => void>(() => {});
  const stop = useCallback(() => closer.current(), []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let context: AudioContext | null = null;
    let socket: WebSocket | null = null;
    let wrapUp: ReturnType<typeof setTimeout> | null = null;

    /**
     * Les trames en attente. En flux, elles couvrent le temps d'ouverture de la
     * liaison et repartent d'un bloc ; en asynchrone, elles sont l'enregistrement
     * lui-même et ne servent qu'à la fin.
     */
    const frames: ArrayBuffer[] = [];
    /** Les énoncés que le moteur a figés, dans l'ordre. Flux seulement. */
    const finals: string[] = [];
    /** Le régime, une fois le serveur consulté. */
    let chosen: DictationMode = "unknown";
    let rate = 16000;

    const startedAt = Date.now();
    let quietSince = startedAt;
    /** Tant qu'il n'a rien dit, le silence ne coupe pas : il cherche ses mots. */
    let spoke = false;
    /** Une seule sortie possible : le silence, le bouton, ou le démontage. */
    let closed = false;
    /*
     * Le dernier partiel est gardé à part : si la liaison se ferme avant que le
     * moteur ait figé son dernier énoncé, c'est tout ce qu'il nous reste de la
     * fin de la phrase — et c'est presque toujours le mot qui compte.
     */
    let pending = "";
    const heardSoFar = () => trim([...finals, pending]);

    function release() {
      cancelled = true;
      if (wrapUp) clearTimeout(wrapUp);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      if (socket && socket.readyState <= WebSocket.OPEN) socket.close();
    }

    /** Le point d'arrivée : ce qui a été entendu, ou l'aveu qu'il n'y a rien. */
    function settle(final: string) {
      if (cancelled) return;
      release();
      const phrase = final.trim();
      if (!phrase) {
        setPhase("failed");
        setError("Je n'ai rien entendu. Reprenez, ou écrivez-le.");
        return;
      }
      latest.current(phrase);
    }

    /**
     * « J'ai fini de parler. » Le micro se coupe tout de suite — c'est ce que le
     * geste veut dire — et la suite dépend du régime : prévenir le moteur qui a
     * tout entendu, ou lui envoyer enfin ce qu'on a gardé.
     */
    function finish() {
      if (closed) return;
      closed = true;
      setPhase("wrapping");
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      conclude();
    }
    closer.current = finish;

    /**
     * Ce qui suit « j'ai fini », et qui **peut devoir attendre** : chez un parent
     * qui dit trois mots, la dictée se termine parfois avant que le serveur ait
     * annoncé son régime, ou avant que la liaison soit ouverte. On ne conclut
     * alors rien du tout — c'est l'annonce, ou l'ouverture, qui rappellera.
     */
    function conclude() {
      if (chosen === "unknown") return;
      if (chosen === "pre-recorded") return void upload();

      if (socket?.readyState === WebSocket.CONNECTING) return;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "stop_recording" }));
        // On n'attend pas indéfiniment la copie définitive : au-delà, ce qui a
        // été entendu vaut mieux qu'un écran qui tourne.
        wrapUp = setTimeout(() => settle(heardSoFar()), WRAP_UP_MS);
        return;
      }
      settle(heardSoFar());
    }

    /** Le régime asynchrone : tout l'audio d'un coup, à la fin. */
    async function upload() {
      if (frames.length === 0) return settle("");
      try {
        const response = await fetch("/api/voix/transcrire", {
          method: "POST",
          headers: { "content-type": "audio/wav" },
          body: toWav(frames, rate),
        });
        const body = await response.json();
        if (!response.ok)
          return fail(body.error ?? "La transcription a échoué.");
        settle((body.transcript as string) ?? "");
      } catch {
        fail("Pas de réseau. Écrivez-le, on comprendra pareil.");
      }
    }

    function fail(message: string) {
      if (cancelled) return;
      release();
      setPhase("failed");
      setError(message);
    }

    function onFrame(pcm: ArrayBuffer, raw: number) {
      if (closed) return;

      // En flux, une trame part dès qu'il y a une liaison ; sinon elle attend,
      // que ce soit l'ouverture de la liaison ou la fin de la dictée.
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(pcm);
      } else if (frames.length < MAX_FRAMES) {
        frames.push(pcm);
      }

      const level = Math.min(1, raw * GAIN);
      setLevels((previous) => [...previous.slice(1), level]);

      const now = Date.now();
      setSeconds(Math.floor((now - startedAt) / 1000));
      if (level > SILENCE_LEVEL) {
        spoke = true;
        quietSince = now;
      }
      if (
        (spoke && now - quietSince > SILENCE_MS) ||
        now - startedAt > MAX_MS
      ) {
        finish();
      }
    }

    function onMessage(event: MessageEvent) {
      if (typeof event.data !== "string") return;
      let message: {
        type?: string;
        data?: {
          is_final?: boolean;
          utterance?: { text?: string };
          transcription?: { full_transcript?: string };
        };
      };
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.type === "transcript") {
        const heard = message.data?.utterance?.text ?? "";
        if (message.data?.is_final) {
          finals.push(heard);
          pending = "";
          setText(trim(finals));
          setPartial("");
        } else {
          pending = heard;
          setPartial(heard.trim());
        }
        return;
      }

      // La copie définitive : elle reprend toute la dictée, ponctuation
      // comprise, et remplace donc notre recollage d'énoncés.
      if (message.type === "post_final_transcript") {
        const full = message.data?.transcription?.full_transcript;
        settle(full?.trim() || heardSoFar());
      }
    }

    async function begin() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        if (cancelled) return;
        setDenied(true);
        setPhase("failed");
        return;
      }
      if (cancelled) return release();

      // On demande 16 kHz — le taux natif du moteur, et huit fois moins d'octets
      // sur le réseau. Certains navigateurs rendent celui de la carte son à la
      // place : c'est celui-là qu'on déclare, jamais celui qu'on espérait.
      context = new AudioContext({ sampleRate: 16000 });
      rate = context.sampleRate;

      // Le fil audio ne charge qu'une URL : on lui en fabrique une à partir du
      // source, plutôt que de déposer un fichier dans `public/` que personne ne
      // relierait jamais à ce crochet.
      const encoderUrl = URL.createObjectURL(
        new Blob([ENCODER], { type: "text/javascript" }),
      );
      try {
        await context.audioWorklet.addModule(encoderUrl);
      } catch {
        return fail(
          "Le micro n'est pas disponible ici. Écrivez-le, c'est pareil.",
        );
      } finally {
        URL.revokeObjectURL(encoderUrl);
      }
      if (cancelled) return release();

      const encoder = new AudioWorkletNode(context, "pcm-encoder");
      encoder.port.onmessage = (event: MessageEvent) =>
        onFrame(event.data.pcm as ArrayBuffer, event.data.level as number);
      // Un nœud n'est tiré que s'il mène quelque part : on le fait passer par un
      // gain nul plutôt que de renvoyer la voix du parent dans ses haut-parleurs.
      const mute = context.createGain();
      mute.gain.value = 0;
      context.createMediaStreamSource(stream).connect(encoder);
      encoder.connect(mute).connect(context.destination);
      setPhase("listening");

      /*
       * Le régime est décidé par le serveur, jamais deviné ici : une variable
       * publique se figerait à la construction du bundle, et on veut pouvoir
       * comparer les deux moteurs sans redéployer (§8.2).
       */
      let announced: VoiceListenReply;
      try {
        const response = await fetch("/api/voix/ecoute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sampleRate: rate }),
        });
        const body = await response.json();
        if (!response.ok)
          return fail(body.error ?? "Le micro n'a pas répondu.");
        announced = body as VoiceListenReply;
      } catch {
        return fail(
          "Pas de réseau. Écrivez-le, ça marchera hors ligne… ou presque.",
        );
      }
      if (cancelled) return release();

      chosen = announced.mode;
      setMode(announced.mode);

      // En asynchrone il n'y a rien de plus à faire maintenant : les trames
      // s'accumulent, et tout part d'un bloc quand le parent se tait.
      if (announced.mode === "pre-recorded") {
        if (closed) conclude();
        return;
      }

      socket = new WebSocket(announced.url);
      socket.onopen = () => {
        for (const frame of frames) socket?.send(frame);
        frames.length = 0;
        if (closed) conclude();
      };
      socket.onmessage = onMessage;
      // Une liaison qui tombe alors qu'on a déjà dit « j'ai fini » n'est pas une
      // panne : c'est le moteur qui raccroche après avoir rendu sa copie. On se
      // contente alors de ce qui a été entendu, plutôt que de jeter la phrase.
      socket.onerror = () => {
        if (cancelled) return;
        if (closed) return settle(heardSoFar());
        fail("La liaison s'est interrompue. Écrivez-le.");
      };
      socket.onclose = () => {
        if (cancelled) return;
        if (closed) return settle(heardSoFar());
        fail("La liaison s'est interrompue. Écrivez-le.");
      };
    }

    void begin();
    return release;
  }, []);

  return { phase, mode, levels, seconds, text, partial, error, denied, stop };
}
