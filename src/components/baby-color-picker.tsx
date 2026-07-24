"use client";

import { cn } from "@/lib/utils";
import {
  AVATAR_COLORS,
  avatarStyle,
  type AvatarColor,
} from "@/lib/avatar-colors";

/**
 * Choix de la couleur de pastille : une grille de vraies pastilles, affichant
 * l'initiale de l'enfant pour qu'on voie le résultat exact avant de valider.
 *
 * Ce sont de véritables boutons radio (masqués visuellement) : la navigation au
 * clavier par les flèches et l'annonce vocale du nom de couleur fonctionnent
 * nativement, sans avoir à réimplémenter le motif ARIA.
 */
export function BabyColorPicker({
  value,
  onChange,
  prenom,
  name = "avatar_color",
  showInitial = true,
  swatchClassName = "size-11 text-base",
  gapClassName = "gap-2.5",
  className,
}: {
  value: AvatarColor;
  onChange: (color: AvatarColor) => void;
  prenom: string;
  name?: string;
  /** Affiche l'initiale de l'enfant dans chaque pastille (aperçu du rendu réel). */
  showInitial?: boolean;
  /** Taille/typo d'une pastille, ex. "size-8 text-sm". */
  swatchClassName?: string;
  /** Espacement entre pastilles, ex. "gap-2". */
  gapClassName?: string;
  className?: string;
}) {
  const initial = prenom.trim().charAt(0).toUpperCase();

  return (
    <fieldset className={className}>
      <legend className="sr-only">Couleur de la pastille</legend>
      <div className={cn("flex flex-wrap", gapClassName)}>
        {AVATAR_COLORS.map((c) => (
          <label key={c.key} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={c.key}
              checked={value === c.key}
              onChange={() => onChange(c.key)}
              aria-label={c.label}
              className="peer sr-only"
            />
            <span
              title={c.label}
              style={avatarStyle(c.key)}
              className={cn(
                "grid place-items-center rounded-full font-bold",
                "ring-offset-2 ring-offset-background transition-transform",
                "hover:scale-110",
                "peer-checked:scale-110 peer-checked:ring-1 peer-checked:ring-foreground",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-ring",
                swatchClassName,
              )}
            >
              {showInitial ? initial : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
