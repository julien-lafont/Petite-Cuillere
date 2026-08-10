"use client";

import { Keyboard, Mic } from "lucide-react";
import { useVoice } from "@/components/voice-provider";

/**
 * Le point d'entrée de la commande vocale sur grand écran : une pastille posée
 * à droite du titre d'« Aujourd'hui ».
 *
 * ── Pourquoi ce n'est plus une carte ───────────────────────────────────────
 * La version précédente était un bloc de 380 px en tête de page, ondes,
 * exemple qui tourne et deux issues secondaires compris. Sur un portable
 * 1440 × 900, la première fiche repas commençait alors à 575 px du haut : un
 * parent qui ouvrait l'application pour savoir quoi préparer voyait un titre de
 * repas et deux ingrédients. C'est le même défaut qui avait fait descendre le
 * micro dans la barre basse sur téléphone (cf. `voice-dock`) — la carte de
 * grand écran était restée le premier essai.
 *
 * La pastille tient dans la hauteur que l'en-tête occupait déjà : le vocal ne
 * coûte plus rien au contenu, et reste au premier endroit où l'œil arrive après
 * le titre.
 *
 * ── Ce que la pastille ne dit plus, et où c'est passé ──────────────────────
 * L'exemple qui tourne et le panneau des familles ne sont pas perdus : ils
 * vivent dans la feuille d'écoute (`voice-listening`), c'est-à-dire exactement
 * pendant les secondes où le parent cherche ses mots. Le déménagement avait
 * déjà eu lieu pour le mobile (docs/feats/commande-vocale.md §5.2) ; la carte
 * les affichait donc en double, au prix du premier écran.
 *
 * ── Deux cibles, pas une ───────────────────────────────────────────────────
 * L'entrée écrite garde son bouton propre. Le micro ouvre la feuille **et**
 * déclenche la demande d'autorisation du navigateur : sans cette seconde cible,
 * un parent dans un bureau — ou qui refuse le micro — devrait traverser une
 * demande de permission pour atteindre un champ texte. « Le champ texte n'est
 * pas une roue de secours, c'est la moitié de la fonctionnalité » (§5.2).
 *
 * Elle ne s'affiche pas au téléphone (`hidden md:inline-flex`) : le micro y vit
 * dans la barre basse, où il est atteignable depuis n'importe quelle page.
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
          {/* Les ondes se propagent derrière la pastille, jamais dedans. */}
          <span
            aria-hidden
            className="voice-halo absolute inset-0 rounded-full bg-primary"
          />
          <span
            aria-hidden
            className="voice-halo absolute inset-0 rounded-full bg-primary [animation-delay:1450ms]"
          />
          <span className="relative grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_26px_-8px_var(--primary)]">
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
