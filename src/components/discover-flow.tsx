"use client";

import { useState } from "react";
import { Onboarding } from "@/components/onboarding";
import { ProgramPreview } from "@/components/program-preview";
import { buildPreview, type Preview } from "@/lib/program/preview";
import type { BabySetup } from "@/lib/data/baby.actions";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";

/**
 * Parcours de découverte **sans compte** : le même questionnaire que
 * l'onboarding, mais le programme est calculé en mémoire et présenté en lecture
 * seule (cf. docs/ux-redesign.md §3.5). Aucune donnée n'est envoyée tant que le
 * parent n'a pas créé son compte.
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
       * Le questionnaire reste monté sous l'aperçu : revenir en arrière
       * (« Modifier ») retrouve les réponses déjà données au lieu de tout
       * redemander.
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
