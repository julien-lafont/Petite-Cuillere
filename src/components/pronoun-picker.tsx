"use client";

import { cn } from "@/lib/utils";
import { PRONOUN_OPTIONS, type Pronoun } from "@/lib/pronoun";

/**
 * Choix du pronom de l'enfant — trois options, une en un geste. `value` peut
 * être null tant que rien n'est choisi (l'étape est obligatoire côté appelant,
 * qui garde le bouton « Continuer » désactivé jusqu'au choix).
 */
export function PronounPicker({
  value,
  onChange,
}: {
  value: Pronoun | null;
  onChange: (p: Pronoun) => void;
}) {
  return (
    <div
      className="grid grid-cols-3 gap-2"
      role="radiogroup"
      aria-label="Pronom"
    >
      {PRONOUN_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-md border-2 px-3 py-3 text-center transition-colors",
              active
                ? "border-primary bg-secondary text-secondary-foreground"
                : "border-transparent bg-muted text-muted-foreground hover:border-primary/40 hover:bg-secondary/60",
            )}
          >
            <span className="block font-heading text-lg font-semibold">
              {opt.label}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {opt.example}
            </span>
          </button>
        );
      })}
    </div>
  );
}
