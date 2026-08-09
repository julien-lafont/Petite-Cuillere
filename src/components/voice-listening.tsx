"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * La feuille d'écoute (docs/feats/commande-vocale.md §5.2).
 *
 * Trois états, nommés à l'écran et pas seulement colorés — « Je vous écoute »,
 * « Je transcris », puis la main repasse au composeur pour « Je réfléchis ».
 * Une couleur seule ne dit pas dans quel état on est, et un micro ouvert sans
 * niveau visible ne dit pas s'il entend quelque chose : c'est la première cause
 * d'abandon d'une interface vocale.
 *
 * **Le niveau affiché est réel.** `getUserMedia` et l'`AnalyserNode` sont déjà
 * branchés : les barres suivent la voix du parent, elles ne rejouent pas une
 * animation. Ce qui manque encore, c'est la transcription (lot 2, Gladia) —
 * `TRANSCRIPTION_PENDING` tient la place et le dit franchement à l'écran.
 */

/** Une seconde tient dans la barre : ~32 échantillons à 30 images par seconde. */
const BARS = 32;
/** En dessous, on considère que le parent s'est tu. Mesuré, pas deviné. */
const SILENCE_LEVEL = 0.05;
const SILENCE_MS = 1500;
/** Filet de sécurité : une dictée fait 8 secondes, jamais une minute. */
const MAX_MS = 30_000;

/**
 * La transcription n'est pas encore branchée (lot 2, Gladia). Tant que c'est
 * vrai, le micro est réel mais c'est la phrase d'exemple qui est rejouée, et
 * l'écran le dit franchement. Le jour où le lot 2 arrive, l'appel remplace
 * `replay()` et cette constante disparaît avec le bandeau.
 */
const TRANSCRIPTION_PENDING = true;
/** Vitesse d'arrivée de la transcription, par mot. */
const WORD_MS = 90;

function Waveform({ levels }: { levels: number[] }) {
  return (
    <div
      aria-hidden
      className="flex h-20 items-center justify-center gap-[3px]"
    >
      {levels.map((level, index) => (
        <span
          key={index}
          className="w-1.5 rounded-full bg-primary transition-[height] duration-75 ease-out"
          style={{
            // 8 px au repos : la barre ne disparaît jamais, sinon le silence se
            // lit comme une panne plutôt que comme un silence.
            height: `${8 + level * 60}px`,
            opacity: 0.4 + level * 0.6,
          }}
        />
      ))}
    </div>
  );
}

export function VoiceListening({
  hint,
  onTranscript,
  onWrite,
}: {
  /** La phrase de démonstration, tant que la transcription n'est pas branchée. */
  hint: string;
  onTranscript: (text: string) => void;
  onWrite: () => void;
}) {
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0));
  const [seconds, setSeconds] = useState(0);
  const [denied, setDenied] = useState(false);
  const [partial, setPartial] = useState<string | null>(null);
  /** Une seule sortie possible : le silence, le bouton, ou le démontage. */
  const closed = useRef(false);
  const release = useRef<() => void>(() => {});
  const typing = useRef<ReturnType<typeof setInterval> | null>(null);
  const handoff = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
   * Les entrées vivantes du composant passent par des refs, et l'écoute ne
   * dépend de rien. Sans ça, un simple rendu du parent — il en survient pour
   * mille raisons — changerait l'identité de `onTranscript`, relancerait
   * l'effet, et couperait le micro au milieu d'une phrase.
   */
  const latest = useRef({ hint, onTranscript });
  useEffect(() => {
    latest.current = { hint, onTranscript };
  });

  const stop = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    release.current();

    // La transcription arrive mot à mot : c'est ce que fera Gladia, et c'est ce
    // qui rend l'attente supportable — on voit que ça avance.
    const phrase = latest.current.hint;
    const words = phrase.split(" ");
    setPartial("");
    let cursor = 0;
    typing.current = setInterval(() => {
      cursor += 1;
      setPartial(words.slice(0, cursor).join(" "));
      if (cursor < words.length) return;
      if (typing.current) clearInterval(typing.current);
      handoff.current = setTimeout(
        () => latest.current.onTranscript(phrase),
        320,
      );
    }, WORD_MS);
  }, []);

  useEffect(() => {
    let frame = 0;
    let ticks = 0;
    let context: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let cancelled = false;
    const startedAt = Date.now();
    let quietSince = startedAt;
    /** Tant qu'il n'a rien dit, le silence ne coupe pas : il cherche ses mots. */
    let spoke = false;

    release.current = () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };

    async function listen() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        if (!cancelled) setDenied(true);
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.7;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.frequencyBinCount);

      const tick = () => {
        frame = requestAnimationFrame(tick);
        ticks += 1;
        // Une image sur deux suffit à l'œil et divise par deux les rendus React.
        if (ticks % 2) return;

        analyser.getByteTimeDomainData(samples);
        let energy = 0;
        for (const sample of samples) {
          const centered = (sample - 128) / 128;
          energy += centered * centered;
        }
        // Le gain est calé sur une voix qui parle à un téléphone posé sur le
        // plan de travail, pas sur un micro de studio : sans lui, une phrase
        // normale ne décolle pas du repos et le parent croit ne pas être entendu.
        const level = Math.min(1, Math.sqrt(energy / samples.length) * 5.5);

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
          stop();
        }
      };
      frame = requestAnimationFrame(tick);
    }

    void listen();
    return () => {
      release.current();
      // Une feuille refermée pendant la transcription ne doit pas rouvrir la
      // suivante trois cents millisecondes plus tard.
      if (typing.current) clearInterval(typing.current);
      if (handoff.current) clearTimeout(handoff.current);
    };
  }, [stop]);

  // ── Le micro est fermé : on bascule sans commentaire vers l'écrit ──────────
  if (denied) {
    return (
      <div className="px-5 py-8 text-center sm:px-7">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <MicOff className="size-6" />
        </div>
        <p className="mt-4 font-heading text-lg font-semibold">
          Le micro n'est pas accessible
        </p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          Votre navigateur ne nous l'a pas autorisé. Écrivez-le, c'est le même
          moteur derrière.
        </p>
        <Button onClick={onWrite} className="mt-5">
          <Keyboard className="size-4" />
          Écrire ma phrase
        </Button>
      </div>
    );
  }

  // ── La transcription arrive ───────────────────────────────────────────────
  if (partial !== null) {
    return (
      <div className="px-5 py-8 text-center sm:px-7">
        <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
          Je transcris
        </p>
        <p className="mx-auto mt-3 min-h-16 max-w-sm font-heading text-lg leading-snug font-medium text-balance">
          « {partial}
          <span className="voice-caret ml-0.5 inline-block h-5 w-0.5 translate-y-0.5 bg-primary align-baseline" />
          »
        </p>
      </div>
    );
  }

  // ── Écoute ────────────────────────────────────────────────────────────────
  return (
    <div className="px-5 py-6 text-center sm:px-7">
      {/*
       * L'en-tête de la feuille dit déjà « Je vous écoute » : ici on ne répète
       * pas les mots, on donne ce qu'ils ne portent pas — que ça enregistre en
       * ce moment, et depuis combien de temps.
       */}
      <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
        <span className="voice-pulse size-2 rounded-full bg-destructive" />
        <span className="tabular-nums">
          {seconds < 10 ? `0:0${seconds}` : `0:${seconds}`}
        </span>
      </p>

      <Waveform levels={levels} />

      <p className="mx-auto max-w-xs text-sm text-muted-foreground">
        Racontez d'un trait. Je m'arrête toute seule quand vous vous taisez.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={stop}
          className="grid size-16 place-items-center rounded-full bg-foreground text-background shadow-lifted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Square className="size-5 fill-current" />
          <span className="sr-only">J'ai fini de parler</span>
        </button>
        <button
          type="button"
          onClick={onWrite}
          className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <Keyboard className="size-4" />
          Écrire plutôt
        </button>
      </div>

      {TRANSCRIPTION_PENDING && (
        <p className="mt-6 text-xs text-muted-foreground">
          Aperçu — la transcription arrive bientôt. En attendant, c'est la
          phrase d'exemple qui est rejouée.
        </p>
      )}
    </div>
  );
}
