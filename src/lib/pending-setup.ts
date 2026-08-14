/**
 * Local keeping of the answers given **before** the account exists (see
 * docs/ux-redesign.md §3.6). The parent describes their baby, sees the
 * programme, then signs up: at that point we replay the answers to persist
 * everything. They re-enter nothing.
 *
 * Deliberately local storage — nothing leaves the device until an account
 * exists, so nothing is sent before consent.
 */

import type { BabySetup } from "@/lib/data/baby.actions";

const KEY = "petite-cuillere:pending-setup";

/** Stores the onboarding answers until the account is created. */
export function savePendingSetup(setup: BabySetup): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(setup));
  } catch {
    // Private browsing or storage full: the preview still works, only the
    // resume-after-signup is lost.
  }
}

/** Reads back the pending answers, or null if there are none. */
export function readPendingSetup(): BabySetup | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BabySetup;
    // Guard: an incomplete object is ignored rather than breaking the app.
    if (!parsed?.prenom || !parsed?.dateNaissance || !parsed?.startISO) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Clears the answers once they have been written to the database. */
export function clearPendingSetup(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Harmless: resuming checks whether a baby exists anyway.
  }
}
