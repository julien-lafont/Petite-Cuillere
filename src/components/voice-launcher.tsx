"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  Heart,
  HelpCircle,
  Keyboard,
  Mic,
  Repeat,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Le point d'entrée de la commande vocale, en tête d'« Aujourd'hui ».
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
 */

type Family = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  examples: string[];
};

/**
 * Quatre familles, calées sur les quatre intentions réellement branchées : on
 * ne montre jamais en exemple une phrase que le moteur ne saurait pas encaisser
 * — une promesse non tenue coûte plus cher qu'une fonctionnalité absente.
 */
const FAMILIES: Family[] = [
  {
    label: "Noter un repas",
    icon: Utensils,
    examples: [
      "Il a mangé des poireaux et de la pomme ce midi",
      "Ce matin, il a eu une compote de poire",
      "Hier soir, c'était courgette et riz",
    ],
  },
  {
    label: "Dire comment ça s'est passé",
    icon: Heart,
    examples: [
      "Il a adoré son déjeuner",
      "Il a tout recraché ce soir",
      "Pas de repas ce midi, on était chez la nounou",
    ],
  },
  {
    label: "Changer quelque chose",
    icon: Repeat,
    examples: [
      "Je n'ai plus de courgette, mets du brocoli",
      "Remplace le panais de demain",
      "Demain midi, ce sera du poulet et des courgettes",
    ],
  },
  {
    label: "Poser une question",
    icon: HelpCircle,
    examples: [
      "Qu'est-ce qu'il doit manger ce soir ?",
      "Combien de grammes de carotte ?",
      "Est-ce que je peux lui donner du miel ?",
    ],
  },
];

/**
 * Les exemples sont entrelacés famille par famille, jamais groupés : deux
 * phrases successives doivent montrer deux pouvoirs différents, sinon le parent
 * qui regarde trois secondes croit que l'application ne sait faire qu'une chose.
 */
const TICKER = [0, 1, 2].flatMap((rank) =>
  FAMILIES.map((family) => ({
    family: family.label,
    phrase: family.examples[rank],
  })),
);

const ROTATION_MS = 4200;

export function VoiceLauncher({
  onStart,
  onWrite,
  onPick,
  busy,
}: {
  /** Reçoit l'exemple affiché : il sert de phrase de démonstration au micro. */
  onStart: (example: string) => void;
  onWrite: () => void;
  /** Un exemple tapé dans le champ, prêt à être adapté puis envoyé. */
  onPick: (phrase: string) => void;
  busy: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % TICKER.length),
      ROTATION_MS,
    );
    return () => clearInterval(timer);
  }, []);

  const current = TICKER[index];

  return (
    <section className="relative isolate rounded-2xl border border-primary/20 bg-card shadow-lifted">
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
              reste — vous relisez avant que ça parte.
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
                onClick={() => onStart(current.phrase)}
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

        {/*
         * L'exemple qui tourne. Pas d'`aria-live` : une zone qui s'annonce
         * toutes les quatre secondes rendrait l'écran inutilisable au lecteur
         * d'écran, alors que le panneau ci-dessous dit exactement la même chose,
         * en entier et sans bouger.
         */}
        <div className="mt-6 flex min-h-24 flex-col justify-center rounded-xl border border-dashed border-primary/25 bg-secondary/40 px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-secondary-foreground/75 uppercase">
            {current.family}
          </p>
          <p
            key={index}
            className="voice-example mt-1 font-heading text-base leading-snug font-medium text-balance"
          >
            « {current.phrase} »
          </p>
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
              Des exemples
            </button>
            <button
              type="button"
              onClick={onWrite}
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Keyboard className="size-4 shrink-0" />
              Écrire plutôt
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FAMILIES.map((family) => (
              <div
                key={family.label}
                className="rounded-xl bg-card-inset p-3.5 ring-1 ring-border/70"
              >
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <family.icon className="size-4 shrink-0 text-primary" />
                  {family.label}
                </p>
                <div className="mt-2 flex flex-col items-start gap-1.5">
                  {family.examples.map((phrase) => (
                    <button
                      key={phrase}
                      type="button"
                      onClick={() => onPick(phrase)}
                      className="rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                    >
                      « {phrase} »
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
