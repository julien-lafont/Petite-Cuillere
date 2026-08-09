"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { VoiceLauncher } from "@/components/voice-launcher";
import { VoiceListening } from "@/components/voice-listening";
import { VoiceIntentBlock, type Block } from "@/components/voice-intent-block";
import { cn } from "@/lib/utils";
import { executeOrders, type VoiceOrder } from "@/lib/data/voice.actions";
import type { FoodRow } from "@/lib/data/foods";
import type { MealMoment } from "@/lib/data/meal-moments";
import type { VoiceReply } from "@/lib/voice/types";

/**
 * « Dites-le comme vous le raconteriez à quelqu'un. C'est noté. »
 *
 * Le composeur tient la machine à états de la dictée, et rien d'autre : le
 * dessin vit dans `voice-launcher` (l'appel), `voice-listening` (l'écoute) et
 * `voice-intent-block` (un ordre compris).
 *
 * Le trajet est **une seule surface qui ne se referme jamais en route** —
 * écoute, transcription, réflexion, confirmation s'y succèdent au même endroit.
 * Une feuille qui disparaît puis revient sous une autre forme fait perdre le fil
 * à un parent qui a une main sur l'enfant ; ici, ce qui change c'est le contenu,
 * jamais le contenant.
 *
 * Trois règles gouvernent la confirmation (docs/feats/commande-vocale.md §5.3) :
 *
 *   · **une intention, une confirmation** — mais un seul tap pour toute la
 *     dictée, et la phrase reste modifiable ;
 *   · **le message d'impact avant validation** — le parent voit ce que le
 *     programme va faire, il n'a pas à le deviner ;
 *   · **rien ne part en base sans lui.** Un nom inconnu du catalogue attend une
 *     décision, il ne s'écrit jamais tout seul (§9.2).
 */

type Step = "idle" | "listening" | "writing" | "thinking" | "reply";

export function VoiceComposer({
  foods,
  moments,
  introducedIds,
  ageMonths,
}: {
  foods: FoodRow[];
  moments: MealMoment[];
  /** Aliments déjà connus de l'enfant — pour annoncer les premières fois. */
  introducedIds: string[];
  ageMonths: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [sentence, setSentence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState<VoiceReply | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [saving, save] = useTransition();
  const field = useRef<HTMLTextAreaElement>(null);

  const foodById = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);
  const introduced = useMemo(() => new Set(introducedIds), [introducedIds]);

  // La confirmation d'enregistrement s'efface d'elle-même : c'est un accusé de
  // réception, pas un message à traiter.
  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(() => setOutcome(null), 9000);
    return () => clearTimeout(timer);
  }, [outcome]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean) return;
    setSentence(clean);
    setStep("thinking");
    setError(null);
    setOutcome(null);
    try {
      const response = await fetch("/api/voix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phrase: clean }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Quelque chose n'a pas fonctionné.");
        setStep("writing");
        return;
      }
      const voice = body as VoiceReply;
      setReply(voice);
      setBlocks(
        voice.intents.map((intent) => ({
          ...intent,
          // Au-delà de six intentions, rien n'est coché d'avance : le parent
          // valide bloc par bloc (§4.5).
          selected: voice.perBlockValidation ? false : intent.ready,
        })),
      );
      setStep("reply");
    } catch {
      setError("Pas de réseau. Réessayez dans un instant.");
      setStep("writing");
    }
  }

  function openWriting(text: string) {
    setSentence(text);
    setError(null);
    setStep("writing");
    setTimeout(() => field.current?.focus(), 60);
  }

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

  /** Les ordres réellement exécutables, dans l'ordre où la carte les affiche. */
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

  // Une question n'a pas de carte — elle a une réponse (§5.3).
  const answer = reply && blocks.length === 0 ? reply.answer : null;

  return (
    <section className="space-y-3">
      <VoiceLauncher
        busy={step !== "idle"}
        onStart={() => {
          setError(null);
          setStep("listening");
        }}
        onWrite={() => openWriting("")}
        onPick={(phrase) => openWriting(phrase)}
      />

      {outcome && (
        <p className="flex items-start gap-2.5 rounded-xl border border-primary/25 bg-secondary px-4 py-3 text-sm font-medium text-secondary-foreground">
          <Check className="mt-0.5 size-4.5 shrink-0" />
          {outcome}
        </p>
      )}

      <Dialog
        open={step !== "idle"}
        // Pendant que le modèle réfléchit, un appui à côté ne referme rien :
        // la requête est partie, on ne la perd pas sur un geste de trop.
        disablePointerDismissal={step === "thinking"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent
          showCloseButton={false}
          // Feuille basse au pouce, boîte centrée sur grand écran. Le padding
          // bas laisse passer la barre d'accueil iOS sous le pied de la feuille.
          className="top-auto bottom-0 grid max-h-[92dvh] w-full max-w-full translate-y-0 grid-rows-[auto_1fr_auto] gap-0 overflow-hidden rounded-b-none p-0 pb-[env(safe-area-inset-bottom)] sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-y-1/2 sm:rounded-b-xl sm:pb-0"
        >
          {/* ── En-tête ─────────────────────────────────────────────────── */}
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
                      ? // Le titre dit d'où vient la réponse : du dossier de
                        // l'enfant, jamais de la culture générale du modèle.
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

          {/* ── Corps ───────────────────────────────────────────────────── */}
          <div className="min-h-0 overflow-y-auto">
            {step === "listening" && (
              <VoiceListening
                onTranscript={(text) => void send(text)}
                onWrite={() => openWriting("")}
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
                    onClick={() => {
                      setError(null);
                      setStep("listening");
                    }}
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

            {step === "reply" && reply && (
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
                 * La réponse à une question : bulle du côté de l'application,
                 * pas un paragraphe perdu. C'est la moitié conversationnelle de
                 * la fonctionnalité, elle mérite la même place que les cartes.
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
                    moments={moments}
                    foods={foods}
                    foodById={foodById}
                    introduced={introduced}
                    ageMonths={ageMonths}
                    withCheckbox={reply.perBlockValidation}
                    onChange={(patch) => updateBlock(block.key, patch)}
                    onFollowUp={(text) => void send(text)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Pied ────────────────────────────────────────────────────── */}
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
                    C'est noté
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={close} className="shrink-0">
                    Fermer
                  </Button>
                  {/* Après une réponse, le micro reste à portée pour enchaîner. */}
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
    </section>
  );
}

/** La phrase comprise, rendue comme ce qu'elle est : quelque chose qu'on a dit. */
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
