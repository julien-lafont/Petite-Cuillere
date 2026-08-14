/**
 * Child badge colours. The database stores the key (`sauge`, `lavande`…); the
 * actual hues live in `globals.css` as `--avatar-<key>` / `--avatar-<key>-fg`
 * CSS variables, which is what lets them switch to dark mode on their own.
 *
 * Adding a colour = one entry here plus the pair of CSS variables. No migration
 * needed: the column is plain text, validated in the app by `resolveAvatarColor`.
 */

export const AVATAR_COLORS = [
  { key: "sauge", label: "Sauge" },
  { key: "eucalyptus", label: "Eucalyptus" },
  { key: "ocean", label: "Océan" },
  { key: "bleuet", label: "Bleuet" },
  { key: "lavande", label: "Lavande" },
  { key: "prune", label: "Prune" },
  { key: "framboise", label: "Framboise" },
  { key: "terracotta", label: "Terracotta" },
  { key: "miel", label: "Miel" },
  { key: "olive", label: "Olive" },
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number]["key"];

/** The original badge hue: existing profiles keep it. */
export const DEFAULT_AVATAR_COLOR: AvatarColor = "sauge";

const KEYS = new Set<string>(AVATAR_COLORS.map((c) => c.key));

/**
 * Maps any stored value to a known colour. A key that is missing, or was
 * dropped from the palette, falls back to the default rather than rendering a
 * transparent badge.
 */
export function resolveAvatarColor(
  value: string | null | undefined,
): AvatarColor {
  return value && KEYS.has(value)
    ? (value as AvatarColor)
    : DEFAULT_AVATAR_COLOR;
}

/** Inline styles for a badge: pale background, dark letter of the same hue. */
export function avatarStyle(value: string | null | undefined) {
  const color = resolveAvatarColor(value);
  return {
    backgroundColor: `var(--avatar-${color})`,
    color: `var(--avatar-${color}-fg)`,
  };
}
