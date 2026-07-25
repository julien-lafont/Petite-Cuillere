/**
 * Couleurs de pastille d'enfant. La valeur stockée en base est la clé (`sauge`,
 * `lavande`…) ; les teintes réelles vivent dans `globals.css` sous forme de
 * variables CSS `--avatar-<clé>` / `--avatar-<clé>-fg`, ce qui leur permet de
 * basculer automatiquement en mode sombre.
 *
 * Ajouter une couleur = une entrée ici + la paire de variables CSS. Aucune
 * migration n'est nécessaire : la colonne est un simple texte, validé côté
 * application par `resolveAvatarColor`.
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

/** Teinte historique des pastilles : les profils existants la conservent. */
export const DEFAULT_AVATAR_COLOR: AvatarColor = "sauge";

const KEYS = new Set<string>(AVATAR_COLORS.map((c) => c.key));

/**
 * Ramène n'importe quelle valeur stockée à une couleur connue. Une clé absente
 * ou retirée de la palette retombe sur la teinte par défaut plutôt que de
 * produire une pastille transparente.
 */
export function resolveAvatarColor(
  value: string | null | undefined,
): AvatarColor {
  return value && KEYS.has(value)
    ? (value as AvatarColor)
    : DEFAULT_AVATAR_COLOR;
}

/** Styles inline d'une pastille : fond pâle + lettre foncée de la même teinte. */
export function avatarStyle(value: string | null | undefined) {
  const color = resolveAvatarColor(value);
  return {
    backgroundColor: `var(--avatar-${color})`,
    color: `var(--avatar-${color}-fg)`,
  };
}
