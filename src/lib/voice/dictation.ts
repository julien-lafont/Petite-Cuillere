"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceListenReply } from "@/lib/voice/types";

/**
 * Dictation, browser side: from the mic to Gladia, live.
 *
 * The whole audio path lives here, and nothing else does. The listening
 * component (`voice-listening.tsx`) only draws what this hook exposes; it knows
 * neither what a PCM frame is nor that a WebSocket exists.
 *
 * The path, in order:
 *
 *   1. **the mic first.** It is the only step the parent has to do anything
 *      about, and the only one that can be refused. The bars move as soon as it
 *      succeeds — before we even know how we will transcribe;
 *   2. **then the mode** (`POST /api/voix/ecoute`), while the mic is already
 *      running. Frames recorded meanwhile are set aside;
 *   3. **and depending on the answer**: either streaming, and the queue goes out
 *      in one block through the connection that just opened, or waiting, and
 *      frames stack up to the last word before leaving in a single upload.
 *
 * The queue is what makes that order bearable: without it, the second between
 * the parent's tap and the server's answer would be a second of lost speech —
 * and nobody says a sentence twice.
 *
 * **One capture for both modes.** The audio worklet produces 16-bit PCM, which
 * streaming consumes frame by frame and async packs into a WAV at the end. That
 * is what lets the sound level, the silence detection and the stopwatch be
 * exactly the same on both sides.
 *
 * Where the audio goes does differ: streaming sends it from the browser to
 * Gladia without us, async routes it back through our own endpoint (§7).
 *
 * In development, React strict mode mounts the effect twice: two sessions are
 * therefore opened per dictation, the first closed immediately. That is
 * expected, and does not happen in production.
 */

/** A second and a quarter fits in the bar: 32 frames at 25 a second. */
const BARS = 32;
/** Below this, we take the parent to have stopped talking. Measured, not guessed. */
const SILENCE_LEVEL = 0.05;
const SILENCE_MS = 3000;
/** Safety net: a dictation lasts 8 seconds, never a minute. */
const MAX_MS = 45_000;
/**
 * After "I've finished speaking", we give the engine time to deliver. Past that
 * we take what is already settled: a sentence to re-read beats a waiting screen.
 */
const WRAP_UP_MS = 2500;
/**
 * The gain is set for a voice talking to a phone on the worktop, not for a
 * studio mic: without it a normal sentence does not lift off the noise floor and
 * the parent thinks they are not being heard.
 */
const GAIN = 5.5;
/**
 * Cap on kept frames, as a count. It covers the whole dictation, because in
 * async mode we keep the entire recording — thirty seconds at twenty-five frames
 * a second, plus a second of margin.
 */
const MAX_FRAMES = Math.ceil((MAX_MS / 1000) * 25) + 25;

/**
 * The encoder, running in the audio worklet.
 *
 * It does two things at once, because it already has the samples to hand: it
 * converts to 16-bit PCM — the only format the API accepts — and it measures the
 * frame's energy. The level shown on screen is therefore that of the audio
 * actually sent, not of a second measurement taken alongside.
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
 * The mode, as the server announced it. Until it answers we record without
 * knowing: frames pile up, and they will serve either way — pushed in one block
 * into the streaming session, or kept for the upload.
 */
export type DictationMode = "live" | "pre-recorded" | "unknown";

/**
 * What only the browser can time, and what goes back as a trace once the card is
 * shown (`POST /api/voix/trace`).
 *
 * The server measures its own calls, but not the §3.4 budget: that one starts at
 * the end of speech and runs across two network round-trips no server clock
 * sees. Hence `endedAt`, which the caller uses as the stopwatch's zero long
 * after this file is done.
 */
export type DictationTiming = {
  /** Speech itself, from the first byte captured to "I'm done". */
  speechMs: number;
  /** The instant speech ended. Zero on the §3.4 budget. */
  endedAt: number;
  /**
   * How long the text kept us waiting after the last word — measured here, in
   * both modes, because it is the only definition that compares them: streaming
   * dissolves transcription into speech and has no server time to declare, async
   * has one that ignores the WAV upload. §3.5 wants that comparison, and two
   * definitions do not make one.
   */
  transcriptionMs: number | null;
  /** The WAV sent. Null in streaming mode: the audio never passes through us (§7). */
  audioKb: number | null;
};

export type Dictation = {
  phase: DictationPhase;
  /** What the screen must promise: text during, or text after. */
  mode: DictationMode;
  /** Sound-level history, oldest to newest, 0 to 1. */
  levels: number[];
  seconds: number;
  /** What is settled: the engine will not revise it. */
  text: string;
  /** The current hypothesis, still revisable word by word. */
  partial: string;
  /** Set in the "failed" phase, and written for the parent. */
  error: string | null;
  /** The mic was refused: not a failure, so we do not offer to retry. */
  denied: boolean;
  /** "I've finished speaking." No effect once listening is closed. */
  stop: () => void;
};

function trim(parts: string[]) {
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * The frames, wrapped in a WAV.
 *
 * Forty-four bytes of header, and that is all: the PCM the audio worklet
 * produces is already what a WAV contains. We could have gone through
 * `MediaRecorder`, but it yields webm for some and mp4 for others — and one of
 * those others is Safari on iPhone, which is the target platform. One capture
 * path for both modes beats two.
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
  header.setUint32(16, 16, true); // size of the "fmt" chunk
  header.setUint16(20, 1, true); // integer PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true); // bytes per second
  header.setUint16(32, 2, true); // bytes per sample
  header.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  header.setUint32(40, bytes, true);
  return new Blob([header.buffer, ...frames], { type: "audio/wav" });
}

export function useDictation({
  onDone,
}: {
  /** The final sentence, once, and only when it contains something. */
  onDone: (text: string, timing: DictationTiming) => void;
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
   * `onDone` goes through a ref, and listening depends on nothing: without that,
   * a plain re-render from the parent — which happens for a thousand reasons —
   * would change the callback's identity, restart the effect, and cut the mic
   * mid-sentence.
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
     * Pending frames. In streaming mode they cover the time it takes to open the
     * connection and leave in one block; in async mode they are the recording
     * itself and are only used at the end.
     */
    const frames: ArrayBuffer[] = [];
    /** The utterances the engine has finalised, in order. Streaming only. */
    const finals: string[] = [];
    /** The mode, once the server has been consulted. */
    let chosen: DictationMode = "unknown";
    let rate = 16000;

    const startedAt = Date.now();
    let quietSince = startedAt;
    /** Set by `finish()`, read by `settle()`: the end of speech. */
    let endedAt = 0;
    let audioKb: number | null = null;
    /** Until they have said something, silence does not cut: they are searching for words. */
    let spoke = false;
    /** Only one way out: the silence, the button, or the unmount. */
    let closed = false;
    /*
     * The last partial is kept separately: if the connection closes before the
     * engine has finalised its last utterance, it is all we have left of the end
     * of the sentence — and it is nearly always the word that matters.
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

    /** The end point: what was heard, or the admission that there is nothing. */
    function settle(final: string) {
      if (cancelled) return;
      release();
      const phrase = final.trim();
      if (!phrase) {
        setPhase("failed");
        setError("Je n'ai rien entendu. Reprenez, ou écrivez-le.");
        return;
      }
      const ended = endedAt || Date.now();
      latest.current(phrase, {
        speechMs: ended - startedAt,
        endedAt: ended,
        // Without `endedAt`, the engine delivered before we told it we had
        // finished: there was no wait to measure.
        transcriptionMs: endedAt ? Date.now() - endedAt : null,
        audioKb,
      });
    }

    /**
     * "I've finished speaking." The mic cuts out immediately — that is what the
     * gesture means — and what follows depends on the mode: tell the engine that
     * heard everything, or finally send it what we kept.
     */
    function finish() {
      if (closed) return;
      closed = true;
      endedAt = Date.now();
      setPhase("wrapping");
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
      conclude();
    }
    closer.current = finish;

    /**
     * What follows "I'm done", and **may have to wait**: with a parent who says
     * three words, the dictation sometimes ends before the server has announced
     * its mode, or before the connection is open. We then conclude nothing at all
     * — the announcement, or the opening, will call back.
     */
    function conclude() {
      if (chosen === "unknown") return;
      if (chosen === "pre-recorded") return void upload();

      if (socket?.readyState === WebSocket.CONNECTING) return;
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "stop_recording" }));
        // We do not wait forever for the final copy: past that, what was heard
        // beats a spinning screen.
        wrapUp = setTimeout(() => settle(heardSoFar()), WRAP_UP_MS);
        return;
      }
      settle(heardSoFar());
    }

    /** Async mode: all the audio at once, at the end. */
    async function upload() {
      if (frames.length === 0) return settle("");
      const wav = toWav(frames, rate);
      audioKb = Math.round(wav.size / 1024);
      try {
        const response = await fetch("/api/voix/transcrire", {
          method: "POST",
          headers: { "content-type": "audio/wav" },
          body: wav,
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

      // In streaming mode a frame leaves as soon as there is a connection;
      // otherwise it waits, for the connection to open or the dictation to end.
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

      // The final copy: it covers the whole dictation, punctuation
      // included, so it replaces our stitched-together utterances.
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

      // We ask for 16 kHz — the engine's native rate, and eight times fewer
      // bytes on the wire. Some browsers hand back the sound card's rate
      // instead: that is the one we declare, never the one we hoped for.
      context = new AudioContext({ sampleRate: 16000 });
      rate = context.sampleRate;

      // The audio worklet only loads a URL: we build one from the source rather
      // than dropping a file in `public/` that nobody would ever connect back to
      // this hook.
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
      // A node only runs when it leads somewhere: we route it through a zero
      // gain rather than sending the parent's voice back out of their speakers.
      const mute = context.createGain();
      mute.gain.value = 0;
      context.createMediaStreamSource(stream).connect(encoder);
      encoder.connect(mute).connect(context.destination);
      setPhase("listening");

      /*
       * The mode is decided by the server, never guessed here: a public variable
       * would freeze into the bundle at build time, and we want to compare the
       * two engines without redeploying (§8.2).
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

      // In async mode there is nothing more to do now: frames pile up, and
      // everything goes in one block when the parent stops talking.
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
      // A connection dropping after we already said "I'm done" is not a
      // failure: it is the engine hanging up once it has delivered. We
      // take what was heard rather than throwing the sentence away.
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
