"use client";

import { useState } from "react";
import { WeekPlanner } from "@/components/week-planner";
import { MenuOnboarding } from "@/components/menu-onboarding";
import type { MealWithDetails } from "@/lib/data/meals.types";
import type { MealMoment } from "@/lib/data/meal-moments";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";

/**
 * Vue du Menu : tant qu'aucun repas n'est configuré, propose l'écran de choix
 * (génération IA ou planning manuel). Sinon — ou une fois le mode manuel
 * choisi — affiche le planning hebdomadaire habituel.
 */
export function MenuView({
  hasAnyMeal,
  programComplete,
  briefing,
  babyName,
  babyId,
  days,
  moments,
  meals,
  foods,
  allergens,
  introducedIds,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  hasAnyMeal: boolean;
  /** Le programme couvre déjà tout l'accompagnement, jusqu'au premier anniversaire. */
  programComplete: boolean;
  /** Bandeau d'explication du programme (rendu côté serveur), null en mode manuel/onboarding. */
  briefing: React.ReactNode;
  babyName: string;
  babyId: string;
  days: string[];
  moments: MealMoment[];
  meals: MealWithDetails[];
  foods: FoodRow[];
  allergens: AllergenRow[];
  introducedIds: string[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
}) {
  const [manual, setManual] = useState(false);

  if (!hasAnyMeal && !manual) {
    return (
      <MenuOnboarding
        babyId={babyId}
        babyName={babyName}
        weekStartISO={days[0]}
        onManual={() => setManual(true)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {briefing}
      <WeekPlanner
        babyId={babyId}
        programComplete={programComplete}
        days={days}
        moments={moments}
        meals={meals}
        foods={foods}
        allergens={allergens}
        introducedIds={introducedIds}
        birthDate={birthDate}
        dueDate={dueDate}
        ageReferenceDate={ageReferenceDate}
      />
    </div>
  );
}
