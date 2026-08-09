"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Keyboard, Loader2, MicOff, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDictation } from "@/lib/voice/dictation";
import { VoiceFamilies, VoiceTicker } from "@/components/voice-examples";
import { cn } from "@/lib/utils";

/**
 * La feuille d'écoute (docs/feats/commande-vocale.md §5.2).
 *
 * Tout ce qui est technique — micro, encodage, liaison, silence — vit dans
 * `useDictation`. Il ne reste ici que la question de dessin, et elle tient en
 * une phrase : **montrer que ça marche pendant que ça marche**.
 *
 * Trois signaux, et pas un de plus, parce qu'ils répondent à trois inquiétudes
 * distinctes qu'un parent a en tenant son téléphone d'une main :
 *
 *   · **le niveau** dit « je vous entends » — un micro ouvert sans niveau
 *     visible ne dit pas s'il capte quelque chose, et c'est la première cause
 *     d'abandon d'une interface vocale ;
 *   · **le texte qui s'écrit** dit « je vous comprends », et c'est le seul des
 *     trois qui se relise. En régime `live`, il apparaît au fil de la phrase et
 *     le temps de transcription disparaît dans le temps de parole ; en régime
 *     `pre-recorded`, il n'arrive qu'à la fin — d'où la consigne qui tient la
 *     place en attendant, et le mot d'attente différent ;
 *   · **le chronomètre** dit « c'est en cours », pour le silence du début,
 *     celui où l'on cherche ses mots.
 *
 * Les états sont nommés à l'écran, jamais seulement colorés : une couleur seule
 * ne dit pas dans quel état on est. Le régime, lui, ne se nomme jamais : c'est
 * une décision d'exploitation, pas une information pour un parent.
 *
 * S'y ajoute un quatrième élément, **qui n'existe que tant que rien n'a été
 * dit** : les exemples. La carte d'appel les portait, elle a disparu du
 * téléphone ; ils se lisent donc ici, exactement pendant les secondes où le
 * parent cherche ses mots — et disparaissent au premier mot prononcé, parce
 * qu'on ne lit pas en parlant. C'est sans risque : `useDictation` ne coupe sur
 * le silence qu'une fois qu'il a entendu quelque chose, on peut donc rester
 * devant la liste sans que le micro se referme.
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
  onTranscript,
  onWrite,
  onPick,
}: {
  onTranscript: (text: string) => void;
  onWrite: () => void;
  /** Un exemple tapé : il part dans le champ texte, prêt à être adapté. */
  onPick: (phrase: string) => void;
}) {
  const { phase, mode, levels, seconds, text, partial, error, denied, stop } =
    useDictation({ onDone: onTranscript });
  const [expanded, setExpanded] = useState(false);

  /* Une longue dictée déroule : c'est la fin de la phrase qu'on relit. */
  const tail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const zone = tail.current;
    if (zone) zone.scrollTop = zone.scrollHeight;
  }, [text, partial]);

  // ── Le micro est fermé, ou la liaison n'a pas tenu ────────────────────────
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

  // ── Le micro s'ouvre ──────────────────────────────────────────────────────
  if (phase === "starting") {
    return (
      <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-5 py-8 sm:px-7">
        <Loader2 className="size-5 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">J'ouvre le micro…</p>
      </div>
    );
  }

  const wrapping = phase === "wrapping";

  // ── Écoute, puis transcription ────────────────────────────────────────────
  return (
    <div className="px-5 py-6 text-center sm:px-7">
      {/*
       * L'en-tête de la feuille dit déjà « Je vous écoute » : ici on ne répète
       * pas les mots, on donne ce qu'ils ne portent pas — que ça enregistre en
       * ce moment, et depuis combien de temps.
       */}
      <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
        {wrapping ? (
          <>
            <Loader2 className="size-3.5 animate-spin text-primary" />
            {/*
             * En flux, la phrase est déjà à l'écran et il ne manque que le
             * dernier mot ; en asynchrone, tout reste à venir. Deux attentes
             * différentes méritent deux mots différents.
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
       * Le cœur de la feuille : la phrase telle qu'elle est comprise, à la
       * seconde. Ce qui est acquis est en pleine couleur, l'hypothèse en cours
       * en gris — la nuance suffit à faire comprendre qu'un mot peut encore
       * changer, sans qu'on ait à l'écrire.
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
       * Les exemples, tant que le silence dure. Ils sont sous le bouton d'arrêt
       * et non au-dessus : ce qui compte pendant l'écoute reste en haut, à sa
       * place, et rien ne bouge quand la phrase arrive et les remplace.
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
