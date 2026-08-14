"use server";

import { createClient } from "@/lib/supabase/server";
import { createFood } from "@/lib/data/foods.actions";
import { setMealResult, saveMeal } from "@/lib/data/meals.actions";
import {
  logMealFoods,
  setMealSkipped,
  substituteFood,
} from "@/lib/data/meal-reality.actions";
import { replanFrom } from "@/lib/data/program.actions";
import { getActiveBaby } from "@/lib/data/baby";
import { getFoods, type FoodRow } from "@/lib/data/foods";
import { getFoodStats } from "@/lib/data/food-stats";
import { getMealMoments, type MealMoment } from "@/lib/data/meal-moments";
import { getNow } from "@/lib/data/household";
import { getAgeInfo } from "@/lib/age";
import type { Appreciation, Nature } from "@/lib/voice/types";

/**
 * Running a confirmed dictation.
 *
 * This file adds **no business rule**. Every order maps to a call into actions
 * that existed before it, with their replanning, their shopping recompute and
 * their RLS. That is what keeps the feature small when it looks big: voice adds
 * no domain logic, it adds an entry point (§1, §9.5).
 */

/** An order: an intent the parent confirmed, cut down to what gets written. */
export type VoiceOrder =
  | {
      type: "logMeal";
      babyId: string;
      date: string;
      momentId: string;
      foodIds: string[];
      appreciation: Appreciation | null;
      nature: Nature;
    }
  | {
      type: "skipMeal";
      babyId: string;
      date: string;
      momentId: string;
      cancel: boolean;
    }
  | {
      type: "rateMeal";
      babyId: string;
      date: string;
      momentId: string;
      appreciation: Appreciation;
    }
  | {
      type: "substituteFood";
      babyId: string;
      date: string;
      momentId: string;
      fromFoodId: string;
      toFoodId: string;
    };

export type ExecutionResult = {
  /** How many orders actually went through. */
  executed: number;
  /** What replanning changed, in one sentence — or `null`. */
  sentence: string | null;
};

/**
 * What it takes to **draw** the confirmation card: the catalogue for the chips,
 * the moments for the labels, the already-known foods to announce first times,
 * the age for the quantities.
 *
 * These four pieces used to be passed as props by "Aujourd'hui". Now that the
 * mic lives in the bottom bar, and so on every page, loading them in the layout
 * would cost three queries per navigation for a card nobody has asked for yet.
 * So we load them when the sheet first opens, while the browser asks for mic
 * permission — the query fits entirely inside the permission prompt.
 *
 * Not to be confused with `loadVoiceContext` (lib/voice/load.ts), which prepares
 * what the **model** reads: this one only serves the screen.
 */
export type VoiceDisplay = {
  foods: FoodRow[];
  moments: MealMoment[];
  introducedIds: string[];
  ageMonths: number;
};

export async function loadVoiceDisplay(): Promise<VoiceDisplay | null> {
  const baby = await getActiveBaby();
  if (!baby) return null;

  const [now, moments] = await Promise.all([getNow(), getMealMoments()]);
  const [foods, stats] = await Promise.all([
    getFoods(),
    getFoodStats(baby.id, now, moments),
  ]);

  const age = getAgeInfo(
    new Date(baby.date_naissance),
    baby.date_terme ? new Date(baby.date_terme) : null,
    baby.age_reference_date ? new Date(baby.age_reference_date) : null,
  );

  const introducedIds: string[] = [];
  for (const [id, stat] of stats) {
    if (stat.exposures > 0) introducedIds.push(id);
  }

  return { foods, moments, introducedIds, ageMonths: age.effectiveMonths };
}

/** The allergens carried by a list of foods — a fact, not a rule. */
async function allergensOf(foodIds: string[]): Promise<string[]> {
  if (foodIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("foods")
    .select("allergen_id")
    .in("id", foodIds)
    .not("allergen_id", "is", null);
  return [
    ...new Set(
      ((data ?? []) as { allergen_id: string }[]).map((f) => f.allergen_id),
    ),
  ];
}

/**
 * Runs the orders **in the order received**.
 *
 * The caller has sorted them chronologically — past reports first, forecasts
 * after. Order matters, because every write triggers `replanFrom` and the plan
 * must see the past before the future is imposed on it (§4.5).
 *
 * We keep the last replanning sentence: it is the only one describing the
 * programme's final state, the one that has seen every order go by.
 */
export async function executeOrders(
  orders: VoiceOrder[],
): Promise<ExecutionResult> {
  let sentence: string | null = null;
  let executed = 0;

  for (const order of orders) {
    switch (order.type) {
      case "logMeal": {
        if (order.nature === "prevision") {
          // A forecast composes an upcoming slot: it locks it without claiming it
          // happened. That is exactly `intent: "plan"`.
          await saveMeal(order.babyId, order.date, order.momentId, {
            result: order.appreciation,
            note: "",
            foodIds: order.foodIds,
            allergenIds: await allergensOf(order.foodIds),
            observations: [],
            intent: "plan",
          });
          const replan = await replanFrom(order.babyId);
          sentence = replan.sentence ?? sentence;
        } else {
          const replan = await logMealFoods(
            order.babyId,
            order.date,
            order.momentId,
            order.foodIds,
          );
          sentence = replan.sentence ?? sentence;
          // The rating comes after the composition: `setMealResult` never
          // downgrades a richer status ("remplacé" stays "remplacé").
          if (order.appreciation) {
            await setMealResult(
              order.babyId,
              order.date,
              order.momentId,
              order.appreciation,
            );
          }
        }
        executed++;
        break;
      }

      case "skipMeal": {
        const replan = await setMealSkipped(
          order.babyId,
          order.date,
          order.momentId,
          !order.cancel,
        );
        sentence = replan.sentence ?? sentence;
        executed++;
        break;
      }

      case "rateMeal": {
        await setMealResult(
          order.babyId,
          order.date,
          order.momentId,
          order.appreciation,
        );
        executed++;
        break;
      }

      case "substituteFood": {
        const replan = await substituteFood(
          order.babyId,
          order.date,
          order.momentId,
          order.fromFoodId,
          order.toFoodId,
        );
        sentence = replan.sentence ?? sentence;
        executed++;
        break;
      }
    }
  }

  return { executed, sentence };
}

/**
 * Creates the food the catalogue did not know.
 *
 * The model is never allowed to write: it only flagged an unknown name, and it
 * is the parent who decides to add it. The food enters the **household's**
 * catalogue, never the common one.
 */
export async function createDictatedFood(
  name: string,
): Promise<{ id: string } | { error: string }> {
  return createFood({
    name,
    category: null,
    ageIntroductionMin: null,
    isAllergen: false,
    allergenType: null,
    texture: null,
    preparation: null,
    restrictions: null,
    quantiteIndicative: null,
    season: null,
  });
}
