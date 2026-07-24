/**
 * Conservation locale des réponses données **avant** la création du compte
 * (cf. docs/ux-redesign.md §3.6). Le parent renseigne son bébé, voit son
 * programme, puis crée son compte : à ce moment-là on rejoue ses réponses pour
 * tout persister. Il ne resaisit rien.
 *
 * Stockage volontairement local (aucune donnée envoyée avant consentement) :
 * tant qu'aucun compte n'existe, rien ne quitte l'appareil.
 */

import type { BabySetup } from "@/lib/data/baby.actions";

const KEY = "petite-cuillere:pending-setup";

/** Enregistre les réponses de l'onboarding en attendant la création du compte. */
export function savePendingSetup(setup: BabySetup): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(setup));
  } catch {
    // Navigation privée ou stockage plein : l'aperçu reste utilisable,
    // seule la reprise après inscription est perdue.
  }
}

/** Relit les réponses en attente, ou null s'il n'y en a pas. */
export function readPendingSetup(): BabySetup | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BabySetup;
    // Garde-fou : un objet incomplet est ignoré plutôt que de casser l'app.
    if (!parsed?.prenom || !parsed?.dateNaissance || !parsed?.startISO) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Efface les réponses une fois qu'elles ont été persistées en base. */
export function clearPendingSetup(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Sans conséquence : la reprise vérifie de toute façon l'existence d'un bébé.
  }
}
