"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isConfirmed } from "@/lib/data/meals.types";
import type {
  MealDraft,
  MealResult,
  MealStatus,
  IntroductionCounts,
} from "@/lib/data/meals.types";

function revalidateApp() {
  revalidatePath("/", "layout");
}

/**
 * Note un repas en un seul geste (« adoré / moyen / refusé »), sans toucher aux
 * aliments ni aux allergènes — c'est l'action de notation rapide de l'écran
 * « Aujourd'hui » (cf. docs/ux-redesign.md §5). Retaper la note active la
 * désélectionne (repas remis à « non renseigné »).
 *
 * Noter vaut **confirmation que le repas a eu lieu** : c'est le geste que le
 * parent fait déjà, il n'a pas à en apprendre un second. Un refus n'échappe pas
 * à la règle — il confirme le repas comme les deux autres, et ne change rien au
 * programme (R5).
 */
export async function setMealResult(
  babyId: string,
  date: string,
  momentId: string,
  result: MealResult,
) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("meals")
    .select("id, status")
    .eq("baby_id", babyId)
    .eq("date", date)
    .eq("meal_moment_id", momentId)
    .maybeSingle();

  // Le repas existe déjà (généré par le programme) : on met juste à jour le résultat.
  if (existing) {
    const current = existing.status as MealStatus;
    await supabase
      .from("meals")
      .update({
        result,
        // Une note pose le statut « servi », sauf si le parent avait déjà dit
        // mieux (composition remplacée) : on ne dégrade jamais un signal plus
        // riche. Retirer la note d'un repas resté conforme le remet en attente.
        status: result
          ? current === "remplace"
            ? "remplace"
            : "servi"
          : current === "servi"
            ? "prevu"
            : current,
        logged_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else if (result) {
    await supabase.from("meals").insert({
      baby_id: babyId,
      date,
      meal_moment_id: momentId,
      result,
      status: "servi",
      logged_at: new Date().toISOString(),
    });
  }
  revalidateApp();
}

/**
 * Persiste l'état complet d'un repas (édition locale validée d'un coup).
 * Réconcilie aliments / allergènes / observations (remplacement complet).
 * Si tout est vide, le repas est supprimé.
 *
 * `draft.intent` dit ce que le parent est en train de faire, ce qui pilote le
 * statut et le verrouillage :
 *
 *   plan     — il compose un repas à venir → verrouillé, reste « prévu »
 *   log      — il raconte ce qui s'est passé → « servi » ou « remplacé »
 *   evaluate — il note seulement, sans toucher à la composition
 */
export async function saveMeal(
  babyId: string,
  date: string,
  momentId: string,
  draft: MealDraft,
) {
  const supabase = await createClient();
  const intent = draft.intent ?? "plan";

  const isEmpty =
    !draft.result &&
    !draft.note.trim() &&
    draft.foodIds.length === 0 &&
    draft.allergenIds.length === 0 &&
    draft.observations.length === 0;

  const { data: existing } = await supabase
    .from("meals")
    .select("id, status, locked, planned_food_ids, meal_items(food_id)")
    .eq("baby_id", babyId)
    .eq("date", date)
    .eq("meal_moment_id", momentId)
    .maybeSingle();

  if (isEmpty) {
    if (existing) await supabase.from("meals").delete().eq("id", existing.id);
    revalidateApp();
    return;
  }

  // Composition d'origine : ce que le programme avait écrit. Mémorisée à la
  // première correction seulement — ensuite elle ne bouge plus, sans quoi la
  // deuxième correction effacerait la trace de la première.
  const previousIds = ((existing?.meal_items ?? []) as { food_id: string }[])
    .map((it) => it.food_id)
    .sort();
  const plannedIds: string[] =
    (existing?.planned_food_ids as string[] | null) ?? previousIds;
  const sameAsPlanned =
    plannedIds.length === draft.foodIds.length &&
    [...draft.foodIds].sort().every((id, i) => id === plannedIds[i]);

  const currentStatus = (existing?.status ?? "prevu") as MealStatus;
  const status: MealStatus =
    intent === "plan"
      ? currentStatus
      : intent === "log"
        ? sameAsPlanned
          ? "servi"
          : "remplace"
        : // evaluate : la note vaut confirmation, sans dégrader un signal plus riche
          draft.result
          ? currentStatus === "remplace"
            ? "remplace"
            : "servi"
          : currentStatus === "servi"
            ? "prevu"
            : currentStatus;

  const stateColumns = {
    status,
    // Le parent a mis les mains dans ce repas : le moteur ne le réécrira plus.
    locked: intent === "evaluate" ? (existing?.locked ?? false) : true,
    logged_at:
      intent === "evaluate" && !draft.result ? null : new Date().toISOString(),
    planned_food_ids: existing?.planned_food_ids ?? plannedIds,
  };

  let mealId = existing?.id as string | undefined;
  if (!mealId) {
    const { data: created, error } = await supabase
      .from("meals")
      .insert({
        baby_id: babyId,
        date,
        meal_moment_id: momentId,
        result: draft.result,
        note: draft.note.trim() || null,
        ...stateColumns,
        // Rien n'était prévu : il n'y a pas de plan d'origine à conserver.
        planned_food_ids: null,
      })
      .select("id")
      .single();
    if (error || !created) return;
    mealId = created.id as string;
  } else {
    await supabase
      .from("meals")
      .update({
        result: draft.result,
        note: draft.note.trim() || null,
        ...stateColumns,
      })
      .eq("id", mealId);
  }

  // Doses et provenances des aliments conservés : les réécrire à plat perdrait
  // les doses du protocole allergènes (« une pointe de cuillère »), qui ne se
  // recalculent pas.
  const { data: priorItems } = await supabase
    .from("meal_items")
    .select("food_id, dose, source, skipped")
    .eq("meal_id", mealId);
  const priorById = new Map(
    (
      (priorItems ?? []) as {
        food_id: string;
        dose: string | null;
        source: string;
        skipped: boolean;
      }[]
    ).map((it) => [it.food_id, it]),
  );

  // Remplacement complet des lignes liées
  await supabase.from("meal_items").delete().eq("meal_id", mealId);
  await supabase.from("meal_allergens").delete().eq("meal_id", mealId);
  await supabase.from("intake_observations").delete().eq("meal_id", mealId);

  if (draft.foodIds.length) {
    await supabase.from("meal_items").insert(
      draft.foodIds.map((food_id) => {
        const prior = priorById.get(food_id);
        return {
          meal_id: mealId,
          food_id,
          dose: prior?.dose ?? null,
          source: prior?.source ?? "parent",
          skipped: prior?.skipped ?? false,
        };
      }),
    );
  }
  if (draft.allergenIds.length) {
    await supabase.from("meal_allergens").insert(
      draft.allergenIds.map((allergen_id) => ({
        meal_id: mealId,
        allergen_id,
      })),
    );
  }
  if (draft.observations.length) {
    await supabase.from("intake_observations").insert(
      draft.observations.map((o) => ({
        meal_id: mealId,
        effect_type: o.effect_type,
        severity: o.severity,
        note: o.note.trim() || null,
      })),
    );
  }

  revalidateApp();
}

/**
 * Nombre d'introductions par aliment / allergène depuis le début du calendrier
 * jusqu'à `dateISO` inclus (pour l'affichage optionnel dans l'éditeur).
 */
export async function getIntroductionCounts(
  babyId: string,
  dateISO: string,
): Promise<IntroductionCounts> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("meals")
    .select(
      "date, status, meal_items(food_id, skipped), meal_allergens(allergen_id)",
    )
    .eq("baby_id", babyId)
    .neq("status", "saute")
    .lte("date", dateISO);

  const foods: Record<string, number> = {};
  const allergens: Record<string, number> = {};
  for (const m of (data ?? []) as {
    status: MealStatus;
    meal_items: { food_id: string; skipped: boolean }[];
    meal_allergens: { allergen_id: string }[];
  }[]) {
    for (const it of m.meal_items ?? []) {
      if (it.skipped) continue;
      foods[it.food_id] = (foods[it.food_id] ?? 0) + 1;
    }
    // Les allergènes ne comptent que sur un repas confirmé : croire l'enfant
    // exposé alors qu'il ne l'a pas été serait le seul mensonge dangereux du
    // produit (asymétrie de confiance, docs/feats §3).
    if (!isConfirmed(m)) continue;
    for (const a of m.meal_allergens ?? [])
      allergens[a.allergen_id] = (allergens[a.allergen_id] ?? 0) + 1;
  }
  return { foods, allergens };
}
