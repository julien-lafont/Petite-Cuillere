/**
 * Deleting a child erases everything the household ever recorded about them,
 * and nothing brings it back — so the confirmation asks for a word rather than
 * a click, which a thumb cannot give by accident.
 *
 * The word lives here rather than next to the action: a "use server" module may
 * only export async functions, and the field the parent types into needs to
 * name the word it expects.
 */
export const DELETE_BABY_WORD = "confirmer";

/**
 * Does what was typed confirm the deletion? Case and surrounding spaces are
 * forgiven — a phone capitalises the first letter on its own — nothing else is.
 */
export function isDeleteBabyConfirmed(input: string): boolean {
  return input.trim().toLowerCase() === DELETE_BABY_WORD;
}
