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
  babyName,
  babyId,
  days,
  moments,
  meals,
  foods,
  allergens,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  hasAnyMeal: boolean;
  babyName: string;
  babyId: string;
  days: string[];
  moments: MealMoment[];
  meals: MealWithDetails[];
  foods: FoodRow[];
  allergens: AllergenRow[];
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
    <WeekPlanner
      babyId={babyId}
      days={days}
      moments={moments}
      meals={meals}
      foods={foods}
      allergens={allergens}
      birthDate={birthDate}
      dueDate={dueDate}
      ageReferenceDate={ageReferenceDate}
    />
  );
}
