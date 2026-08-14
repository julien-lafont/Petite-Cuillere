"use client";

import { useEffect, useState } from "react";
import { Heart, HelpCircle, Repeat, Utensils } from "lucide-react";

/**
 * What the machine can handle, shown rather than explained.
 *
 * Nobody guesses what an engine understands: a permanently rotating example and
 * the full list one tap away are the only teaching that works for an interface
 * with no buttons.
 *
 * These two blocks used to live in the call-to-action card, which now only
 * exists on large screens. On a phone the mic moved down into the bottom bar and
 * the card disappeared: the teaching followed the gesture, and now reads in the
 * listening sheet, during the seconds the parent is searching for words.
 */

type Family = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  examples: string[];
};

/**
 * Four families, matching the four intents actually wired up: we never show as
 * an example a sentence the engine could not handle — an unkept promise costs
 * more than a missing feature.
 */
export const FAMILIES: Family[] = [
  {
    label: "Enregistrer un repas",
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
    label: "Modifier le menu",
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
 * The examples are interleaved family by family, never grouped: two successive
 * sentences must show two different powers, or a parent watching for three
 * seconds concludes the app can only do one thing.
 */
const TICKER = [0, 1, 2].flatMap((rank) =>
  FAMILIES.map((family) => ({
    family: family.label,
    phrase: family.examples[rank],
  })),
);

const ROTATION_MS = 4200;

/**
 * The rotating example. No `aria-live`: a region announcing itself every four
 * seconds would make the screen unusable with a screen reader, while the
 * families panel says exactly the same thing, in full and without moving.
 */
export function VoiceTicker() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % TICKER.length),
      ROTATION_MS,
    );
    return () => clearInterval(timer);
  }, []);

  const current = TICKER[index];

  return (
    <>
      <p className="text-xs font-semibold tracking-wide text-secondary-foreground/75 uppercase">
        {current.family}
      </p>
      <p
        key={index}
        className="voice-example mt-1 font-heading text-base leading-snug font-medium text-balance"
      >
        « {current.phrase} »
      </p>
    </>
  );
}

/**
 * The full list, unfolded on demand. Each sentence is a target: tap it to find
 * it in the text field, ready to adapt — quicker than retyping it, and it shows
 * there is nothing magic about it.
 */
export function VoiceFamilies({
  onPick,
  className,
}: {
  onPick: (phrase: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      {FAMILIES.map((family) => (
        <div
          key={family.label}
          className="rounded-xl bg-card-inset p-3.5 text-left ring-1 ring-border/70"
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
  );
}
