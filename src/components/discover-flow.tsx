"use client";

import { useState } from "react";
import { Onboarding } from "@/components/onboarding";
import { ProgramPreview } from "@/components/program-preview";
import { buildPreview, type Preview } from "@/lib/program/preview";
import type { BabySetup } from "@/lib/data/baby.actions";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";

/**
 * Discovery flow **without an account**: the same questionnaire as the
 * onboarding, but the programme is computed in memory and shown read-only (see
 * docs/ux-redesign.md §3.5). No data is sent until the parent creates an
 * account.
 */
export function DiscoverFlow({
  foods,
  allergens,
}: {
  foods: FoodRow[];
  allergens: AllergenRow[];
}) {
  const [result, setResult] = useState<{
    setup: BabySetup;
    preview: Preview;
  } | null>(null);

  function handleComplete(setup: BabySetup) {
    setResult({ setup, preview: buildPreview(setup, foods, allergens) });
    window.scrollTo({ top: 0 });
  }

  return (
    <>
      {/*
       * The questionnaire stays mounted below the preview: going back
       * ("Modifier") finds the answers already given instead of asking for
       * everything again.
       */}
      <div className={result ? "hidden" : undefined}>
        <Onboarding
          foods={foods}
          allergens={allergens}
          mode="preview"
          onPreviewComplete={handleComplete}
        />
      </div>

      {result && (
        <ProgramPreview
          setup={result.setup}
          preview={result.preview}
          onEdit={() => setResult(null)}
        />
      )}
    </>
  );
}
