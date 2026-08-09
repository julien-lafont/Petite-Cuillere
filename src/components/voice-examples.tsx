"use client";

import { useEffect, useState } from "react";
import { Heart, HelpCircle, Repeat, Utensils } from "lucide-react";

/**
 * Ce que la machine sait encaisser, montré plutôt qu'expliqué.
 *
 * Personne ne devine ce qu'un moteur comprend : un exemple qui tourne en
 * permanence et la liste entière à un tap sont la seule pédagogie qui tienne
 * pour une interface sans bouton.
 *
 * Ces deux blocs vivaient dans la carte d'appel, qui n'existe plus que sur
 * grand écran. Sur téléphone, le micro est descendu dans la barre basse et la
 * carte a disparu : la pédagogie a suivi le geste, elle se lit maintenant dans
 * la feuille d'écoute, pendant les secondes où le parent cherche ses mots.
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

/**
 * L'exemple qui tourne. Pas d'`aria-live` : une zone qui s'annonce toutes les
 * quatre secondes rendrait l'écran inutilisable au lecteur d'écran, alors que le
 * panneau des familles dit exactement la même chose, en entier et sans bouger.
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
 * La liste entière, dépliée à la demande. Chaque phrase est une cible : on la
 * tape pour la retrouver dans le champ texte, prête à être adaptée — c'est plus
 * rapide que de la recopier, et ça montre qu'elle n'a rien de magique.
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
