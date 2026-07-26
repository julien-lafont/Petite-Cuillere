"use client";

import { Venus, Mars } from "lucide-react";
import { cn } from "@/lib/utils";
import { SEXE_OPTIONS, type Sexe } from "@/lib/sexe";

const ICONS: Record<Sexe, typeof Venus> = {
  fille: Venus,
  garcon: Mars,
};

/**
 * Choix du sexe de l'enfant — deux options, une en un geste. `value` peut être
 * null tant que rien n'est choisi (l'étape est obligatoire côté appelant, qui
 * garde le bouton « Continuer » désactivé jusqu'au choix).
 */
export function SexePicker({
  value,
  onChange,
}: {
  value: Sexe | null;
  onChange: (s: Sexe) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Sexe">
      {SEXE_OPTIONS.map((opt) => {
        const active = value === opt.value;
        const Icon = ICONS[opt.value];
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-lg border-2 px-3 py-5 text-center transition-colors",
              active
                ? "border-primary bg-secondary text-secondary-foreground"
                : "border-transparent bg-muted text-muted-foreground hover:border-primary/40 hover:bg-secondary/60",
            )}
          >
            <span
              className={cn(
                "grid size-11 place-items-center rounded-full transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-background/70 text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
            </span>
            <span className="font-heading text-base font-semibold">
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
