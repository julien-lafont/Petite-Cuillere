"use client";

import { useEffect, useRef } from "react";
import { saveHouseholdTimeZone } from "@/lib/data/household.actions";

/**
 * Le seul endroit d'où l'application apprend l'heure qu'il est chez le parent.
 *
 * Le serveur ne peut pas la deviner — en production il tourne en UTC — et le
 * produit n'a aucune raison de demander son fuseau à un parent qui vient noter
 * une compote. On le détecte donc une fois, en silence.
 *
 * Ne rend rien, et n'écrit que sur désaccord : en régime normal (le foyer n'a
 * pas bougé) le composant ne déclenche aucune requête. Le rattrapage se fera au
 * prochain rendu serveur, ce qui suffit largement pour une donnée qui change
 * une fois par déménagement.
 */
export function TimeZoneProbe({ stored }: { stored: string }) {
  // Une seule tentative par montage : `saveHouseholdTimeZone` revalide le
  // layout, donc sans ce garde la révalidation relancerait l'effet.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!detected || detected === stored) return;
    sent.current = true;
    void saveHouseholdTimeZone(detected);
  }, [stored]);

  return null;
}
