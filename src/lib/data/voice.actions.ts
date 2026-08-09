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
import { getAgeInfo } from "@/lib/age";
import { toISODate } from "@/lib/dates";
import type { Appreciation, Nature } from "@/lib/voice/types";

/**
 * L'exécution d'une dictée confirmée.
 *
 * Ce fichier n'ajoute **aucune règle métier**. Chaque ordre se traduit en un
 * appel aux actions qui existaient avant lui, avec leur replanification, leur
 * recalcul de courses et leur RLS. C'est ce qui rend la fonctionnalité petite
 * alors qu'elle a l'air grosse : le vocal n'ajoute pas de métier, il ajoute une
 * entrée (§1, §9.5).
 */

/** Un ordre : une intention validée par le parent, réduite à ce qui s'écrit. */
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
  /** Nombre d'ordres réellement passés. */
  executed: number;
  /** Ce que la replanification a changé, en une phrase — ou `null`. */
  sentence: string | null;
};

/**
 * De quoi **dessiner** la carte de confirmation : le catalogue pour les puces,
 * les moments pour les intitulés, les aliments déjà connus pour annoncer les
 * premières fois, l'âge pour les quantités.
 *
 * Ces quatre pièces étaient passées en props par « Aujourd'hui ». Le micro
 * vivant désormais dans la barre basse, donc sur toutes les pages, les charger
 * dans le layout coûterait trois requêtes à chaque navigation pour une carte que
 * personne n'a encore demandée. On les charge donc à la première ouverture de la
 * feuille, pendant que le navigateur demande l'autorisation du micro — le temps
 * de la requête tient tout entier dans celui de la permission.
 *
 * À ne pas confondre avec `loadVoiceContext` (lib/voice/load.ts), qui prépare ce
 * que le **modèle** lit : celui-ci ne sert qu'à l'écran.
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

  const [foods, moments, stats] = await Promise.all([
    getFoods(),
    getMealMoments(),
    getFoodStats(baby.id, toISODate(new Date())),
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

/** Les allergènes portés par une liste d'aliments — une donnée, pas une règle. */
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
 * Exécute les ordres **dans l'ordre reçu**.
 *
 * L'appelant les a triés chronologiquement — les constats passés d'abord, les
 * prévisions ensuite. L'ordre compte, parce que chaque écriture déclenche
 * `replanFrom` et que le plan doit voir le passé avant qu'on lui impose
 * l'avenir (§4.5).
 *
 * On garde la dernière phrase de replanification : c'est la seule qui décrive
 * l'état final du programme, celle qui a vu passer tous les ordres.
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
          // Une prévision compose un créneau à venir : elle le verrouille sans
          // prétendre qu'il a eu lieu. C'est exactement `intent: "plan"`.
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
          // La note vient après la composition : `setMealResult` ne dégrade
          // jamais un statut plus riche (« remplacé » reste « remplacé »).
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
 * Crée l'aliment que le catalogue ne connaissait pas.
 *
 * Le modèle n'a jamais le droit d'écrire : il a seulement signalé un nom
 * inconnu, et c'est le parent qui décide de l'ajouter. L'aliment entre dans le
 * catalogue **du foyer**, jamais dans le catalogue commun.
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
