/**
 * Maximum lengths for text entered in the app.
 *
 * None is a business rule: the tightest is twice the longest value in the
 * shipped catalogue, and nobody meets them while writing. They exist because
 * PostgREST accepts whatever RLS lets through, and a food name is copied into
 * the prompt on every dictation the household makes.
 *
 * The database carries the same values (migration 0027) and is the sole
 * authority; these say **which** field to fix, which a constraint violation
 * cannot.
 */
export const TEXT_LIMITS = {
  foodName: 80,
  foodCategory: 40,
  foodAllergenType: 40,
  foodTexture: 60,
  foodPreparation: 500,
  foodRestrictions: 300,
  foodQuantity: 120,
  momentLabel: 40,
  mealNote: 1000,
  observationNote: 1000,
  personPrenom: 50,
  personRelation: 60,
} as const;

/** A field to validate: its on-screen label, its value, its bound. */
type Bounded = [label: string, value: string | null | undefined, max: number];

/**
 * Refusal message for the first field that is too long, or `null`. The label is
 * the one the parent reads on screen.
 */
export function tooLongMessage(fields: Bounded[]): string | null {
  for (const [label, value, max] of fields) {
    if ((value?.length ?? 0) > max) {
      return `${label} ne peut pas dépasser ${max} caractères.`;
    }
  }
  return null;
}

/**
 * Clips to the bound, silently.
 *
 * For parent notes only: "save first, never refuse" (see
 * `meal-reality.actions.ts`) — a parent whose entry is rejected stops entering.
 */
export function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
