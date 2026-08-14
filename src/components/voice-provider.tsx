"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Loader2,
  Mic,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SpoonIcon } from "@/components/brand-mark";
import { VoiceListening } from "@/components/voice-listening";
import { VoiceIntentBlock, type Block } from "@/components/voice-intent-block";
import { cn } from "@/lib/utils";
import {
  executeOrders,
  loadVoiceDisplay,
  type VoiceDisplay,
  type VoiceOrder,
} from "@/lib/data/voice.actions";
import type { DictationTiming } from "@/lib/voice/dictation";
import type { VoiceReply } from "@/lib/voice/types";

/**
 * "Say it the way you would tell someone. It's noted."
 *
 * The provider holds the dictation state machine, and nothing else: the drawing
 * lives in `voice-launcher` (the large-screen call), `voice-dock` (the bottom
 * bar badge), `voice-listening` (listening) and `voice-intent-block` (an order
 * understood).
 *
 * It is mounted by the shell, not by a page: voice is not a place you go, it is
 * a gesture you make from where you are (docs/feats/commande-vocale.md §5.1).
 * That is also what lets the two entry points — the large-screen card, the thumb
 * badge — drive one and the same sheet.
 *
 * The journey is **one surface that never closes on the way** — listening,
 * transcription, thinking, confirmation follow each other in the same place. A
 * sheet that disappears then comes back in another form loses the thread for a
 * parent with one hand on their child; here what changes is the content, never
 * the container.
 *
 * Three rules govern confirmation (docs/feats/commande-vocale.md §5.3):
 *
 *   · **one intent, one confirmation** — but a single tap for the whole
 *     dictation, and the sentence stays editable;
 *   · **the impact message before confirming** — the parent sees what the
 *     programme will do, they should not have to guess;
 *   · **nothing reaches the database without them.** A name unknown to the
 *     catalogue waits for a decision, it never writes itself (§9.2).
 */

type Step = "idle" | "listening" | "writing" | "thinking" | "reply";

type VoiceApi = {
  /** Ouvre la feuille, micro compris. */
  start: () => void;
  /** Opens the sheet on the text field, possibly prefilled. */
  write: (phrase?: string) => void;
  /** The sheet is open: the entry points go quiet. */
  busy: boolean;
};

const VoiceContext = createContext<VoiceApi | null>(null);

export function useVoice(): VoiceApi {
  const api = use(VoiceContext);
  if (!api) throw new Error("useVoice appelé hors de VoiceProvider");
  return api;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [sentence, setSentence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<VoiceReply | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [saving, save] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);

  /*
   * What it takes to draw the confirmation card. Loaded once, on first opening,
   * and kept for the session: the catalogue and the moments do not move between
   * two sentences.
   */
  const [display, setDisplay] = useState<VoiceDisplay | null>(null);
  const pendingDisplay = useRef<Promise<VoiceDisplay | null> | null>(null);

  const ensureDisplay = useCallback(() => {
    pendingDisplay.current ??= loadVoiceDisplay()
      .then((loaded) => {
        setDisplay(loaded);
        return loaded;
      })
      .catch(() => {
        // A failure must not condemn the session: the next opening will retry
        // rather than serve a permanent `null`.
        pendingDisplay.current = null;
        return null;
      });
    return pendingDisplay.current;
  }, []);

  const foodById = useMemo(
    () => new Map((display?.foods ?? []).map((f) => [f.id, f])),
    [display],
  );
  const introduced = useMemo(
    () => new Set(display?.introducedIds ?? []),
    [display],
  );

  // The save confirmation clears itself: it is an acknowledgement, not a message
  // to deal with.
  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(() => setOutcome(null), 9000);
    return () => clearTimeout(timer);
  }, [outcome]);

  /**
   * `dictation` carries what the browser timed before reaching here: the speech,
   * the transcription, and above all the instant the parent stopped talking.
   * Null for a typed sentence — the stopwatch then starts at send time.
   */
  async function send(text: string, dictation: DictationTiming | null = null) {
    const clean = text.trim();
    if (!clean) return;
    const askedAt = Date.now();
    setSentence(clean);
    setStep("thinking");
    setError(null);
    setOutcome(null);
    try {
      const [response, loaded] = await Promise.all([
        fetch("/api/voix", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phrase: clean }),
        }),
        ensureDisplay(),
      ]);
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Quelque chose n'a pas fonctionné.");
        setStep("writing");
        return;
      }
      if (!loaded) {
        setError(
          "Je n'ai pas pu relire son dossier. Réessayez dans un instant.",
        );
        setStep("writing");
        return;
      }
      const voice = body as VoiceReply;
      setReply(voice);
      setBlocks(
        voice.intents.map((intent) => ({
          ...intent,
          // Past six intents, nothing is pre-ticked: the parent confirms block by
          // block (§4.5).
          selected: voice.perBlockValidation ? false : intent.ready,
        })),
      );
      setStep("reply");
      trace(voice, dictation, dictation?.endedAt ?? askedAt);
    } catch {
      setError("Pas de réseau. Réessayez dans un instant.");
      setStep("writing");
    }
  }

  const openWriting = useCallback(
    (text: string) => {
      void ensureDisplay();
      setSentence(text);
      setError(null);
      setStep("writing");
      setTimeout(() => field.current?.focus(), 60);
    },
    [ensureDisplay],
  );

  const openListening = useCallback(() => {
    void ensureDisplay();
    setError(null);
    setStep("listening");
  }, [ensureDisplay]);

  function close() {
    setStep("idle");
    setReply(null);
    setBlocks([]);
    setSentence("");
    setError(null);
  }

  function updateBlock(key: string, patch: (block: Block) => Block) {
    setBlocks((prev) => prev.map((b) => (b.key === key ? patch(b) : b)));
  }

  /** The orders actually runnable, in the order the card shows them. */
  const orders: VoiceOrder[] = blocks.flatMap((block): VoiceOrder[] => {
    if (!block.selected) return [];
    const detail = block.detail;
    if (detail.type === "logMeal") {
      if (detail.foods.length === 0) return [];
      if (detail.foods.some((f) => f.state !== "resolved")) return [];
      return [
        {
          type: "logMeal",
          babyId: block.babyId,
          date: detail.slot.date,
          momentId: detail.slot.momentId,
          foodIds: detail.foods.map((f) => (f as { id: string }).id),
          appreciation: detail.appreciation,
          nature: detail.nature,
        },
      ];
    }
    if (detail.type === "skipMeal") {
      return [
        {
          type: "skipMeal",
          babyId: block.babyId,
          date: detail.slot.date,
          momentId: detail.slot.momentId,
          cancel: detail.cancel,
        },
      ];
    }
    if (detail.type === "rateMeal") {
      return [
        {
          type: "rateMeal",
          babyId: block.babyId,
          date: detail.slot.date,
          momentId: detail.slot.momentId,
          appreciation: detail.appreciation,
        },
      ];
    }
    if (detail.type === "substituteFood") {
      if (
        detail.missing.state !== "resolved" ||
        detail.replacement?.state !== "resolved"
      ) {
        return [];
      }
      return [
        {
          type: "substituteFood",
          babyId: block.babyId,
          date: detail.slot.date,
          momentId: detail.slot.momentId,
          fromFoodId: detail.missing.id,
          toFoodId: detail.replacement.id,
        },
      ];
    }
    return [];
  });

  function confirm() {
    save(async () => {
      const result = await executeOrders(orders);
      router.refresh();
      close();
      setOutcome(
        result.sentence ??
          (result.executed > 0
            ? `C'est noté (${result.executed} enregistrement${result.executed > 1 ? "s" : ""}).`
            : null),
      );
    });
  }

  const api = useMemo<VoiceApi>(
    () => ({
      start: openListening,
      write: (phrase = "") => openWriting(phrase),
      busy: step !== "idle",
    }),
    [openListening, openWriting, step],
  );

  // A question has no card — it has an answer (§5.3).
  const answer = reply && blocks.length === 0 ? reply.answer : null;

  return (
    <VoiceContext value={api}>
      {children}

      {/*
       * The acknowledgement. It floats above the bottom bar rather than under the
       * call-to-action card: that card is gone from the phone, and a message
       * inserted into the flow would make the page jump under the parent's eyes
       * at the exact moment they are re-reading what was just saved.
       */}
      {outcome && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 pb-3 md:bottom-0 md:pb-6 md:pl-64">
          <p className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl border border-primary/25 bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground shadow-lifted">
            <Check className="mt-0.5 size-4.5 shrink-0" />
            {outcome}
          </p>
        </div>
      )}

      <Dialog
        open={step !== "idle"}
        // While the model is thinking, a tap outside closes nothing: the
        // request is out, we do not lose it on one gesture too many.
        disablePointerDismissal={step === "thinking"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          showCloseButton={false}
          // Bottom sheet under the thumb, centred box on a large screen. The
          // bottom padding leaves room for the iOS home bar under the footer.
          className="top-auto bottom-0 grid max-h-[92dvh] w-full max-w-full translate-y-0 grid-rows-[auto_1fr_auto] gap-0 overflow-hidden rounded-b-none p-0 pb-[env(safe-area-inset-bottom)] sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-y-1/2 sm:rounded-b-xl sm:pb-0"
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="relative flex items-center gap-3 border-b px-5 py-3.5 sm:px-7">
            <span
              aria-hidden
              className="blob grid size-9 shrink-0 place-items-center bg-apricot text-apricot-foreground"
            >
              <SpoonIcon className="size-4.5" />
            </span>
            <DialogTitle className="min-w-0 flex-1 truncate text-base">
              {step === "listening"
                ? "Je vous écoute"
                : step === "writing"
                  ? "Je vous écoute !"
                  : step === "thinking"
                    ? "Je réfléchis…"
                    : answer
                      ? // The title says where the answer comes from: the child's
                        // record, never the model's general knowledge.
                        "Ce que je sais"
                      : "C'est bien ça ?"}
            </DialogTitle>
            <DialogClose
              render={<Button variant="ghost" size="icon-sm" />}
              aria-label="Fermer"
            >
              <X className="size-4" />
            </DialogClose>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="min-h-0 overflow-y-auto">
            {step === "listening" && (
              <VoiceListening
                onTranscript={(text, timing) => void send(text, timing)}
                onWrite={() => openWriting("")}
                onPick={(phrase) => openWriting(phrase)}
              />
            )}

            {step === "writing" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(sentence);
                }}
                className="px-5 py-5 sm:px-7"
              >
                <label htmlFor="voix" className="sr-only">
                  Racontez ce qui s'est passé
                </label>
                <Textarea
                  id="voix"
                  ref={field}
                  value={sentence}
                  onChange={(event) => setSentence(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send(sentence);
                    }
                  }}
                  rows={3}
                  placeholder="« Il a mangé des poireaux et de la pomme ce midi, il a adoré »"
                  className="min-h-24 resize-none text-base"
                />
                {error && (
                  <p className="mt-3 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive">
                    {error}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={openListening}
                    className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Mic className="size-4" />
                    Mode vocal
                  </button>
                  <Button type="submit" size="lg" disabled={!sentence.trim()}>
                    <Sparkles className="size-4" />
                    Comprendre
                  </Button>
                </div>
              </form>
            )}

            {step === "thinking" && (
              <div className="px-5 py-8 sm:px-7">
                <Transcript text={sentence} />
                <p className="mt-5 flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Je regarde le programme de la semaine…
                </p>
              </div>
            )}

            {step === "reply" && reply && display && (
              <div className="space-y-4 px-5 py-5 sm:px-7">
                <div className="flex items-start gap-2">
                  <Transcript text={reply.transcript} className="flex-1" />
                  <button
                    type="button"
                    onClick={() => openWriting(reply.transcript)}
                    aria-label="Corriger la phrase"
                    className="mt-1 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="size-4" />
                  </button>
                </div>

                {/*
                 * The answer to a question: a bubble on the app's side, not a
                 * stray paragraph. It is the conversational half of the feature,
                 * and deserves the same place as the cards.
                 */}
                {answer && (
                  <div className="rounded-2xl rounded-tl-md border border-primary/15 bg-secondary/50 px-4 py-3.5">
                    <p className="text-[0.95rem] leading-relaxed whitespace-pre-line">
                      {answer}
                    </p>
                  </div>
                )}

                {reply.perBlockValidation && blocks.length > 0 && (
                  <p className="rounded-lg bg-novelty-soft px-3.5 py-2.5 text-sm text-foreground/85">
                    Beaucoup de choses d'un coup — cochez ce que vous voulez
                    enregistrer.
                  </p>
                )}

                {blocks.map((block) => (
                  <VoiceIntentBlock
                    key={block.key}
                    block={block}
                    moments={display.moments}
                    foods={display.foods}
                    foodById={foodById}
                    introduced={introduced}
                    ageMonths={display.ageMonths}
                    withCheckbox={reply.perBlockValidation}
                    onChange={(patch) => updateBlock(block.key, patch)}
                    onFollowUp={(text) => void send(text)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          {step === "reply" && (
            <div className="flex items-center gap-3 border-t bg-muted/40 px-5 py-3.5 sm:px-7">
              {blocks.length > 0 ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={close}
                    disabled={saving}
                    className="shrink-0"
                  >
                    Annuler
                  </Button>
                  <Button
                    size="lg"
                    onClick={confirm}
                    disabled={saving || orders.length === 0}
                    className="flex-1"
                  >
                    {saving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Confirmer
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={close} className="shrink-0">
                    Fermer
                  </Button>
                  {/* After an answer, the mic stays within reach to carry on. */}
                  <Button
                    size="lg"
                    onClick={() => {
                      setReply(null);
                      setBlocks([]);
                      setStep("listening");
                    }}
                    className="flex-1"
                  >
                    <Mic className="size-4" />
                    Autre chose
                    <ArrowRight className="size-4" />
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </VoiceContext>
  );
}

/**
 * Measuring the dictation, once the card is rendered (§3.4).
 *
 * `since` is the budget's zero: the end of speech when there was some, the
 * sending of the sentence otherwise. The stopwatch stops when the card is handed
 * to React — a few milliseconds before it is painted, and that is the only
 * imprecision we allow ourselves, because measuring it would cost a layout
 * effect on the critical path.
 *
 * Nothing waits on this call, and nothing breaks if it fails: `keepalive` so it
 * survives the sheet closing, and the failure is swallowed.
 */
function trace(
  reply: VoiceReply,
  dictation: DictationTiming | null,
  since: number,
) {
  void fetch("/api/voix/trace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      typed: dictation === null,
      speechMs: dictation?.speechMs,
      transcriptionMs: dictation?.transcriptionMs,
      audioKb: dictation?.audioKb,
      understandingMs: reply.latency.understanding,
      routeMs: reply.latency.total,
      perceivedMs: Date.now() - since,
      transcriptLength: reply.transcript.length,
      cacheRead: reply.cacheRead,
      intents: reply.intents.length,
    }),
  }).catch(() => {});
}

/** The sentence understood, rendered for what it is: something that was said. */
function Transcript({ text, className }: { text: string; className?: string }) {
  return (
    <p
      className={cn(
        "rounded-2xl rounded-tr-md bg-muted px-4 py-3 text-[0.95rem] leading-relaxed text-foreground/85 italic",
        className,
      )}
    >
      « {text} »
    </p>
  );
}
