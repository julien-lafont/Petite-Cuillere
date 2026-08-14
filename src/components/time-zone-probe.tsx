"use client";

import { useEffect, useRef } from "react";
import { saveHouseholdTimeZone } from "@/lib/data/household.actions";

/**
 * The only place the app learns what time it is at the parent's home.
 *
 * The server cannot guess it — in production it runs in UTC — and the product
 * has no reason to ask a parent logging a compote for their timezone. So we
 * detect it once, silently.
 *
 * Renders nothing, and writes only on disagreement: in normal use (the household
 * has not moved) the component fires no request. Any correction happens on the
 * next server render, which is plenty for a value that changes once per house
 * move.
 */
export function TimeZoneProbe({ stored }: { stored: string }) {
  // One attempt per mount: `saveHouseholdTimeZone` revalidates the layout, so
  // without this guard the revalidation would restart the effect.
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
