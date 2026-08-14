"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Keyboard, Loader2, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDictation, type DictationTiming } from "@/lib/voice/dictation";
import { VoiceFamilies, VoiceTicker } from "@/components/voice-examples";
import { cn } from "@/lib/utils";

/**
 * The listening sheet (docs/feats/commande-vocale.md §5.2).
 *
 * Everything technical — mic, encoding, connection, silence — lives in
 * `useDictation`. All that is left here is the drawing, and it fits in one
 * sentence: **show it is working while it works**.
 *
 * Three signals, and not one more, because they answer three distinct worries a
 * parent has while holding their phone one-handed:
 *
 *   · **the level** says "I can hear you" — an open mic with no visible level
 *     does not say whether it is picking anything up, and that is the first
 *     cause of abandonment in a voice interface;
 *   · **the text being written** says "I understand you", and it is the only one
 *     of the three you can re-read. In `live` mode it appears as the sentence
 *     goes and transcription time disappears into speaking time; in
 *     `pre-recorded` it only arrives at the end — hence the prompt holding the
 *     space meanwhile, and the different waiting word;
 *   · **the stopwatch** says "this is running", for the silence at the start, the
 *     one where you search for words.
 *
 * States are named on screen, never only coloured: a colour alone does not say
 * which state you are in. The mode, by contrast, is never named: it is an
 * operational decision, not information for a parent.
 *
 * A fourth element joins them, **and only while nothing has been said**: the
 * examples. The call-to-action card carried them, and it is gone from the phone;
 * so they read here, exactly during the seconds the parent is searching for
 * words — and vanish at the first word spoken, because you do not read while
 * talking. That is safe: `useDictation` only cuts on silence once it has heard
 * something, so you can sit in front of the list without the mic closing.
 */

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
            // 8 px at rest: the bar never disappears, or silence would read as a
            // failure rather than as silence.
            height: `${8 + level * 60}px`,
            opacity: 0.4 + level * 0.6,
          }}
        />
      ))}
    </div>
  );
}

export function VoiceListening({
  onTranscript,
  onWrite,
  onPick,
}: {
  onTranscript: (text: string, timing: DictationTiming) => void;
  onWrite: () => void;
  /** A tapped example: it goes into the text field, ready to adapt. */
  onPick: (phrase: string) => void;
}) {
  const { phase, mode, levels, seconds, text, partial, error, denied, stop } =
    useDictation({ onDone: onTranscript });
  const [expanded, setExpanded] = useState(false);

  /* A long dictation scrolls: it is the end of the sentence you re-read. */
  const tail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zone = tail.current;
    if (zone) zone.scrollTop = zone.scrollHeight;
  }, [text, partial]);

  // ── The mic is closed, or the connection did not hold ─────────────────────
  if (phase === "failed") {
    return (
      <div className="px-5 py-8 text-center sm:px-7">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-muted text-muted-foreground">
          <MicOff className="size-6" />
        </div>
        <p className="mt-4 font-heading text-lg font-semibold">
          {denied ? "Le micro n'est pas accessible" : "L'écoute s'est arrêtée"}
        </p>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
          {denied
            ? "Votre navigateur ne nous l'a pas autorisé. Écrivez-le, c'est le même moteur derrière."
            : error}
        </p>
        <Button onClick={onWrite} className="mt-5">
          <Keyboard className="size-4" />
          Écrire ma phrase
        </Button>
      </div>
    );
  }

  // ── The mic opens ─────────────────────────────────────────────────────────
  if (phase === "starting") {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-5 py-8 sm:px-7">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">J'ouvre le micro…</p>
      </div>
    );
  }

  const wrapping = phase === "wrapping";

  // ── Listening, then transcription ─────────────────────────────────────────
  return (
    <div className="px-5 py-6 text-center sm:px-7">
      {/*
       * The sheet's header already says "Je vous écoute": we do not repeat the
       * words here, we give what they do not carry — that it is recording right
       * now, and for how long.
       */}
      <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
        {wrapping ? (
          <>
            <Loader2 className="size-3.5 animate-spin text-primary" />
            {/*
             * In streaming the sentence is already on screen and only the last
             * word is missing; in async everything is still to come. Two
             * different waits deserve two different words.
             */}
            {mode === "pre-recorded"
              ? "Je transcris…"
              : "Je termine la phrase…"}
          </>
        ) : (
          <>
            <span className="voice-pulse size-2 rounded-full bg-destructive" />
            <span className="tabular-nums">
              {seconds < 10 ? `0:0${seconds}` : `0:${seconds}`}
            </span>
          </>
        )}
      </p>

      <Waveform levels={wrapping ? levels.map(() => 0) : levels} />

      {/*
       * The heart of the sheet: the sentence as understood, second by second.
       * What is settled is in full colour, the current hypothesis in grey — the
       * shade is enough to convey that a word may still change, without spelling
       * it out.
       */}
      <div
        ref={tail}
        className="mx-auto max-h-28 min-h-16 max-w-sm overflow-y-auto"
      >
        {text || partial ? (
          <p className="font-heading text-lg leading-snug font-medium text-balance">
            « {text}
            {partial && (
              <span className="text-muted-foreground">
                {text ? " " : ""}
                {partial}
              </span>
            )}
            <span className="voice-caret ml-0.5 inline-block h-5 w-0.5 translate-y-0.5 bg-primary align-baseline" />
            »
          </p>
        ) : (
          <p className="pt-2 text-sm text-muted-foreground">
            Racontez d'un trait. Je m'arrête toute seule quand vous vous taisez.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={stop}
          disabled={wrapping}
          className="grid size-16 place-items-center rounded-full bg-foreground text-background shadow-lifted transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-40"
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

      {/*
       * The examples, for as long as the silence lasts. They sit below the stop
       * button rather than above: what matters while listening stays at the top,
       * in place, and nothing moves when the sentence arrives and replaces them.
       */}
      {!text && !partial && !wrapping && (
        <div className="mt-6 border-t pt-4">
          <div className="rounded-xl bg-secondary/40 px-4 py-3">
            <VoiceTicker />
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mx-auto mt-2 inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronDown
              className={cn(
                "size-4 shrink-0 transition-transform",
                expanded && "rotate-180",
              )}
            />
            Que puis-je dire ?
          </button>
          {expanded && (
            <VoiceFamilies onPick={onPick} className="mt-2 grid gap-3" />
          )}
        </div>
      )}
    </div>
  );
}
