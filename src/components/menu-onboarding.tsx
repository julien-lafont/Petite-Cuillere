"use client";

import { PencilLine, ArrowRight } from "lucide-react";
import { AutoProgramDialog } from "@/components/auto-program-dialog";

/**
 * État vide du planning, affiché uniquement si un foyer se retrouve sans aucun
 * repas (ex. après suppression). En temps normal, le programme est généré
 * automatiquement à la création du bébé (décision D2) : cet écran est un filet
 * de sécurité, pas une étape du parcours.
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
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Le planning de {babyName} est vide
        </h1>
        <p className="mt-2 text-muted-foreground">
          Regénérez le programme de diversification, ou composez les repas
          vous-même.
        </p>
      </div>

      <AutoProgramDialog
        babyId={babyId}
        weekStartISO={weekStartISO}
        trigger={
          <button
            type="button"
            className="group flex w-full items-center gap-4 rounded-lg border-2 border-primary/30 bg-secondary p-5 text-left transition-colors hover:border-primary/50"
          >
            <div className="min-w-0 flex-1">
              <h2 className="font-heading text-base font-semibold">
                Générer le programme
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Repas adaptés à l'âge de {babyName}, introduction progressive
                des aliments et des allergènes, d'après les recommandations des
                autorités de santé.
              </p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
          </button>
        }
      />

      <button
        type="button"
        onClick={onManual}
        className="group flex w-full items-center gap-4 rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <PencilLine className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold">
            Composer les repas moi-même
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Affiche le planning vierge et ajoute les repas, créneau par créneau.
          </p>
        </div>
        <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </button>
    </div>
  );
}
