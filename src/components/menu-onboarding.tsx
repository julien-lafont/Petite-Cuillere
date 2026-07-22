"use client";

import { Sparkles, PencilLine, ArrowRight, Check } from "lucide-react";
import { AutoProgramDialog } from "@/components/auto-program-dialog";

/**
 * Écran de premier lancement du Menu, affiché tant qu'aucun repas n'est
 * configuré. Deux voies : générer le plan de diversification par IA (option
 * mise en avant) ou construire le planning manuellement.
 */
export function MenuOnboarding({
  babyId,
  babyName,
  weekStartISO,
  onManual,
}: {
  babyId: string;
  babyName: string;
  weekStartISO: string;
  onManual: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-extrabold tracking-tight md:text-3xl">
          Composons le menu de {babyName}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Par où veux-tu commencer&nbsp;?
        </p>
      </div>

      {/* Option mise en avant : génération IA */}
      <AutoProgramDialog
        babyId={babyId}
        weekStartISO={weekStartISO}
        trigger={
          <button
            type="button"
            className="group relative w-full overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/[0.06] to-transparent p-6 text-left shadow-sm transition-all hover:border-primary/50 hover:shadow-md"
          >
            <span className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-primary/10 blur-2xl" />
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-lg font-extrabold">
                    Générer le plan par IA
                  </h2>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    Recommandé
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  L&apos;intelligence artificielle bâtit un plan de
                  diversification adapté à l&apos;âge de {babyName}&nbsp;:
                  introduction progressive des aliments et des allergènes, repas
                  prêts à ajuster.
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {[
                    "Adapté au stade de diversification",
                    "Allergènes introduits un par un, en sécurité",
                    "Modifiable à tout moment",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Générer avec l&apos;IA
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </button>
        }
      />

      {/* Option secondaire : planning manuel */}
      <button
        type="button"
        onClick={onManual}
        className="group flex w-full items-center gap-4 rounded-2xl border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
          <PencilLine className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-bold">
            Créer les repas manuellement
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Affiche le planning vierge et ajoute toi-même les premiers repas,
            créneau par créneau.
          </p>
        </div>
        <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Repère d&apos;organisation, pas un avis médical.
      </p>
    </div>
  );
}
