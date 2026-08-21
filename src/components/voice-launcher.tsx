"use client";

import { Keyboard, Mic } from "lucide-react";
import { useVoice } from "@/components/voice-provider";

/**
 * The voice entry point on a large screen: a badge sitting to the right of the
 * "Aujourd'hui" title.
 *
 * ── Why it is no longer a card ─────────────────────────────────────────────
 * The previous version was a 380 px block at the top of the page, waves, a
 * rotating example and two secondary exits included. On a 1440 × 900 laptop the
 * first meal card then started 575 px down: a parent opening the app to find out
 * what to cook saw one meal title and two ingredients. It is the same fault that
 * had already moved the mic into the bottom bar on phones (see `voice-dock`) —
 * the large-screen card was simply the first attempt, left in place.
 *
 * The badge fits in the height the header already took: voice costs the content
 * nothing, and stays at the first place the eye reaches after the title.
 *
 * ── What the badge no longer says, and where it went ───────────────────────
 * The rotating example and the families panel are not lost: they live in the
 * listening sheet (`voice-listening`), that is, exactly during the seconds the
 * parent is searching for words. The move had already happened for mobile
 * (docs/feats/commande-vocale.md §5.2); the card was therefore showing them
 * twice, at the cost of the first screen.
 *
 * ── Two targets, not one ───────────────────────────────────────────────────
 * Typed entry keeps its own button. The mic opens the sheet **and** triggers the
 * browser's permission prompt: without that second target, a parent in an office
 * — or who refuses the mic — would have to walk through a permission request to
 * reach a text field. "The text field is not a spare wheel, it is half the
 * feature" (§5.2).
 *
 * It does not show on a phone (`hidden md:inline-flex`): there the mic lives in
 * the bottom bar, reachable from any page.
 */

export function VoiceLauncher() {
  const { start, write, busy } = useVoice();

  return (
    <div className="hidden shrink-0 items-center gap-1 rounded-full border border-primary/20 bg-card p-1.5 shadow-soft md:inline-flex">
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="flex items-center gap-3 rounded-full pr-3 text-left transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
      >
        <span className="relative grid shrink-0 place-items-center">
          {/* The waves spread behind the badge, never inside it. */}
          <span
            aria-hidden
            className="voice-halo absolute inset-0 rounded-full bg-primary"
          />
          <span
            aria-hidden
            className="voice-halo absolute inset-0 rounded-full bg-primary [animation-delay:1450ms]"
          />
          <span className="relative grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-primary-lg">
            <Mic className="size-5.5" />
          </span>
        </span>
        <span className="block leading-tight">
          <span className="block font-heading text-sm font-semibold">
            Dites-le, c'est noté.
          </span>
          <span className="block text-xs text-muted-foreground">
            Appuyez, puis parlez
          </span>
        </span>
      </button>

      <span aria-hidden className="h-8 w-px shrink-0 bg-border" />

      <button
        type="button"
        onClick={() => write()}
        aria-label="Écrire ma phrase"
        className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Keyboard className="size-4.5" />
      </button>
    </div>
  );
}
