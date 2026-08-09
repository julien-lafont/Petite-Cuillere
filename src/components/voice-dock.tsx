"use client";

import { useSyncExternalStore } from "react";
import { Mic, X } from "lucide-react";
import { useVoice } from "@/components/voice-provider";

/**
 * Le micro au pouce : une pastille encastrée au centre de la barre basse, qui
 * déborde par le haut.
 *
 * La carte d'appel occupait 490 px en tête d'« Aujourd'hui », soit la quasi-
 * totalité du premier écran d'un petit téléphone, pour un geste qui n'en
 * demande qu'un. Le micro redevient donc ce que la spec décrivait au départ
 * (docs/feats/commande-vocale.md §5.1) : **pas une destination, un geste** —
 * disponible depuis n'importe quelle page, et non plus depuis la seule qui le
 * portait.
 *
 * Le centre, plutôt qu'un coin : c'est le seul endroit qu'un pouce atteint sans
 * viser, de la main gauche comme de la main droite. Il impose un nombre pair
 * d'onglets autour de lui — c'est ce qui a fait descendre « Mon foyer » de
 * l'en-tête vers la barre (cf. `app-shell`).
 *
 * Le débord vers le haut, enfin, n'est pas un effet de style : une pastille
 * alignée sur les autres cibles se lirait comme un quatrième onglet, c'est-à-dire
 * comme un endroit où l'on va. L'anneau à la couleur du fond découpe la barre
 * autour d'elle et dit qu'elle n'appartient pas à la même famille.
 */

/**
 * La bulle d'amorce, montrée une fois pour toutes. Sans elle, la fonctionnalité
 * la plus importante du produit n'est plus annoncée nulle part sur téléphone :
 * un rond n'apprend à personne qu'il écoute. Elle s'efface au premier usage
 * comme au premier refus — dans les deux cas, le parent a vu.
 *
 * Le stockage local est traité comme ce qu'il est, une source extérieure à
 * React : le serveur le déclare « déjà vu » (donc pas de bulle dans le HTML
 * envoyé), le client dit la vérité à l'hydratation. C'est ce que
 * `useSyncExternalStore` fait proprement, là où un `useEffect` qui pose l'état
 * après le montage provoquerait un rendu en cascade.
 */
const HINT_SEEN = "petite-cuillere.voix.amorce";

const listeners = new Set<() => void>();
let seen: boolean | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readSeen() {
  if (seen === null) {
    try {
      seen = localStorage.getItem(HINT_SEEN) !== null;
    } catch {
      // Stockage refusé (navigation privée stricte) : pas de bulle, tant pis.
      seen = true;
    }
  }
  return seen;
}

function markSeen() {
  if (readSeen()) return;
  seen = true;
  try {
    localStorage.setItem(HINT_SEEN, "1");
  } catch {
    // Rien à faire : la bulle repassera à la prochaine session, sans dommage.
  }
  for (const listener of listeners) listener();
}

export function VoiceDock() {
  const { start, busy } = useVoice();
  const hint = !useSyncExternalStore(subscribe, readSeen, () => true);

  return (
    <div className="relative">
      {hint && (
        <div className="absolute bottom-full left-1/2 z-10 mb-7 w-60 -translate-x-1/2 rounded-2xl bg-foreground px-4 py-3 text-background shadow-lifted">
          <p className="pr-5 font-heading text-sm font-semibold">
            Dites-le, c'est noté.
          </p>
          <p className="mt-0.5 pr-5 text-xs text-background/75">
            Appuyez, puis racontez le repas comme à quelqu'un.
          </p>
          <button
            type="button"
            onClick={markSeen}
            aria-label="J'ai compris"
            className="absolute top-2 right-2 grid size-7 place-items-center rounded-full text-background/70 transition-colors hover:bg-background/15 hover:text-background"
          >
            <X className="size-3.5" />
          </button>
          {/* La pointe, qui rattache la bulle à la pastille. */}
          <span
            aria-hidden
            className="absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 rotate-45 rounded-[2px] bg-foreground"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          markSeen();
          start();
        }}
        disabled={busy}
        // Le découpage dans la barre passe par `outline`, jamais par `ring` :
        // le ring est réservé au focus, qui l'écraserait et ferait disparaître
        // l'anneau au moment précis où la cible doit être la plus lisible.
        className="absolute -top-5 left-1/2 grid size-15 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_26px_-8px_var(--primary)] outline-4 outline-background transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <Mic className="size-6.5" />
        <span className="sr-only">Dicter une phrase</span>
      </button>
    </div>
  );
}
