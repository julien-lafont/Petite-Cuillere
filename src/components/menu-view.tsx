"use client";

import { useState } from "react";
import { WeekPlanner } from "@/components/week-planner";
import { MenuOnboarding } from "@/components/menu-onboarding";
import type { MealWithDetails } from "@/lib/data/meals.types";
import type { MealMoment } from "@/lib/data/meal-moments";
import type { Now } from "@/lib/clock";
import type { FoodRow } from "@/lib/data/foods";
import type { AllergenRow } from "@/lib/data/allergens";

/**
 * The Menu view: while no meal is set up, it offers the choice screen (AI
 * generation or manual planning). Otherwise — or once manual mode is chosen —
 * it shows the usual weekly planner.
 */
export function MenuView({
  hasAnyMeal,
  programComplete,
  now,
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
  /** The programme already covers all of our support, up to the first birthday. */
  programComplete: boolean;
  /** The instant as the household sees it — never `new Date()` in the browser. */
  now: Now;
  /** Programme explanation banner (rendered on the server), null in manual/onboarding mode. */
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
        now={now}
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
