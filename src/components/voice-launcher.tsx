"use client";

import { useState } from "react";
import { ChevronDown, Keyboard, Mic } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoice } from "@/components/voice-provider";
import { VoiceFamilies, VoiceTicker } from "@/components/voice-examples";

/**
 * Le point d'entrée de la commande vocale sur grand écran, en tête
 * d'« Aujourd'hui ».
 *
 * Ce n'est pas une carte comme les autres, et c'est délibéré : la parole est le
 * geste central du produit (docs/feats/commande-vocale.md §1), l'écriture n'en
 * est que le repli — et la relecture d'une transcription. D'où trois partis
 * pris qui gouvernent tout le dessin :
 *
 *   · **le micro est la seule cible qui compte.** 88 px, plein centre, un halo
 *     qui respire. Rien d'autre ici ne lui dispute le regard ;
 *   · **le champ texte est replié.** Un textarea toujours ouvert dit
 *     « formulaire » là où on veut dire « parlez » ; il s'ouvre à la demande,
 *     et de lui-même quand le micro n'est pas accessible ;
 *   · **on apprend en lisant.** Personne ne devine ce qu'une machine comprend :
 *     un exemple tourne en permanence, et la liste entière est à un tap. C'est
 *     la seule pédagogie qui tienne pour une interface sans bouton.
 *
 * **Elle ne s'affiche plus au téléphone** (`hidden md:block`). Elle mesurait
 * 490 px de haut, soit la quasi-totalité du premier écran d'un iPhone SE : un
 * parent qui ouvrait « Aujourd'hui » pour voir le repas de midi devait défiler
 * pour l'atteindre. Sur mobile, le micro est descendu dans la barre basse
 * (`voice-dock`) et tout le module tient dans la feuille ; en `sm:flex-row`, ici,
 * la carte n'occupe que 180 px et ne coûte rien à personne.
 */

export function VoiceLauncher() {
  const { start, write, busy } = useVoice();
  const [expanded, setExpanded] = useState(false);

  return (
    <section className="relative isolate hidden rounded-2xl border border-primary/20 bg-card shadow-lifted md:block">
      {/*
       * Les taches de la marque, en fond : elles empêchent le bloc de se lire
       * comme une carte de plus, sans rien coûter en lisibilité puisqu'aucun
       * texte ne repose dessus (cf. globals.css, « forme signature »).
       *
       * Le rognage vit sur ce calque-ci, et non sur la carte : posé sur la
       * carte, il coupait net les ondes du micro, qui débordent volontairement
       * — un halo tranché par un angle arrondi se lit comme un bug d'affichage.
       */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
      >
        <div className="blob absolute -top-20 -right-16 size-52 bg-secondary/70" />
        <div className="blob-alt absolute -bottom-20 -left-16 size-44 bg-accent/45" />
      </div>

      <div className="relative p-5 sm:p-7">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-novelty-soft px-2.5 py-1 text-xs font-bold tracking-wide text-novelty uppercase">
              Commande vocale
            </span>
            <h2 className="mt-3 font-heading text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
              Dites-le, c'est noté.
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Une phrase, comme vous le raconteriez à quelqu'un. On s'occupe du
              reste !
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2.5">
            <div className="relative">
              {/* Les ondes se propagent derrière le bouton, jamais dedans. */}
              <span
                aria-hidden
                className="voice-halo absolute inset-0 rounded-full bg-primary"
              />
              <span
                aria-hidden
                className="voice-halo absolute inset-0 rounded-full bg-primary [animation-delay:1450ms]"
              />
              <button
                type="button"
                onClick={start}
                disabled={busy}
                className="relative grid size-22 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_14px_34px_-10px_var(--primary)] transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 sm:size-24"
              >
                <Mic className="size-9" />
                <span className="sr-only">Dicter une phrase</span>
              </button>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">
              Appuyez, puis parlez
            </p>
          </div>
        </div>

        <div className="mt-6 flex min-h-24 flex-col justify-center rounded-xl border border-dashed border-primary/25 bg-secondary/40 px-4 py-3">
          <VoiceTicker />
        </div>

        {/*
         * Deux issues secondaires, à parts égales et sur une seule ligne : un
         * séparateur qui passe à la ligne sur un écran étroit se lit comme une
         * coquille, et ces deux boutons sont trop proches du bord pour tolérer
         * une cible molle.
         */}
        <div className="mt-5 border-t pt-3">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:w-fit sm:gap-4">
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 transition-transform",
                  expanded && "rotate-180",
                )}
              />
              Exemples
            </button>
            <button
              type="button"
              onClick={() => write()}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Keyboard className="size-4 shrink-0" />
              Chatter
            </button>
          </div>
        </div>

        {expanded && (
          <VoiceFamilies
            onPick={write}
            className="mt-4 grid gap-3 sm:grid-cols-2"
          />
        )}
      </div>
    </section>
  );
}
