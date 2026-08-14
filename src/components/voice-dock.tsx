"use client";

import { useSyncExternalStore } from "react";
import { Mic, X } from "lucide-react";
import { useVoice } from "@/components/voice-provider";

/**
 * The mic at thumb height: a badge inset into the centre of the bottom bar,
 * overhanging the top of it.
 *
 * The call-to-action card took 490 px at the top of "Aujourd'hui", nearly the
 * whole first screen of a small phone, for a gesture that needs one. So the mic
 * goes back to what the spec described in the first place
 * (docs/feats/commande-vocale.md §5.1): **not a destination, a gesture** —
 * available from any page, rather than from the only one that carried it.
 *
 * The centre, rather than a corner: it is the one place a thumb reaches without
 * aiming, left hand or right. It forces an even number of tabs around it — which
 * is what moved "Mon foyer" down from the header into the bar (see `app-shell`).
 *
 * The overhang, finally, is not styling: a badge aligned with the other targets
 * would read as a fourth tab, that is, as a place you go. The ring in the
 * background colour cuts the bar around it and says it does not belong to the
 * same family.
 */

/**
 * The primer bubble, shown once and for all. Without it, the product's most
 * important feature is announced nowhere on a phone: a circle teaches nobody
 * that it listens. It clears on first use as on first refusal — either way, the
 * parent has seen it.
 *
 * Local storage is treated as what it is, a source outside React: the server
 * declares it "already seen" (so no bubble in the HTML sent), the client tells
 * the truth at hydration. That is what `useSyncExternalStore` does cleanly,
 * where a `useEffect` setting state after mount would cause a cascading render.
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
      // Storage refused (strict private browsing): no bubble, so be it.
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
    // Nothing to do: the bubble will come back next session, no harm done.
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
          {/* The tail, tying the bubble to the badge. */}
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
        // The cut-out in the bar goes through `outline`, never `ring`: the
        // ring is reserved for focus, which would override it and remove the
        // halo at the exact moment the target must be clearest.
        className="absolute -top-5 left-1/2 grid size-15 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_26px_-8px_var(--primary)] outline-4 outline-background transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <Mic className="size-6.5" />
        <span className="sr-only">Dicter une phrase</span>
      </button>
    </div>
  );
}
