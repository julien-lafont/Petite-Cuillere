"use client";

import { cn } from "@/lib/utils";
import {
  AVATAR_COLORS,
  avatarStyle,
  type AvatarColor,
} from "@/lib/avatar-colors";

/**
 * Picking the badge colour: a grid of real badges, showing the child's initial
 * so the exact result is visible before confirming.
 *
 * These are genuine radio buttons (visually hidden): arrow-key navigation and
 * screen-reader announcement of the colour name work natively, with no need to
 * reimplement the ARIA pattern.
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
  /** Shows the child's initial in each badge (a preview of the real thing). */
  showInitial?: boolean;
  /** Size/typography of one badge, e.g. "size-8 text-sm". */
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
