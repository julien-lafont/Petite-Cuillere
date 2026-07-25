"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  MealDraft,
  MealResult,
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
    .select("id")
    .eq("baby_id", babyId)
    .eq("date", date)
    .eq("meal_moment_id", momentId)
    .maybeSingle();

  // Le repas existe déjà (généré par le programme) : on met juste à jour le résultat.
  if (existing) {
    await supabase.from("meals").update({ result }).eq("id", existing.id);
  } else if (result) {
    await supabase.from("meals").insert({
      baby_id: babyId,
      date,
      meal_moment_id: momentId,
      result,
    });
  }
  revalidateApp();
}

/**
 * Persiste l'état complet d'un repas (édition locale validée d'un coup).
 * Réconcilie aliments / allergènes / observations (remplacement complet).
 * Si tout est vide, le repas est supprimé.
 */
export async function saveMeal(
  babyId: string,
  date: string,
  momentId: string,
  draft: MealDraft,
) {
  const supabase = await createClient();

  const isEmpty =
    !draft.result &&
    !draft.note.trim() &&
    draft.foodIds.length === 0 &&
    draft.allergenIds.length === 0 &&
    draft.observations.length === 0;

  const { data: existing } = await supabase
    .from("meals")
    .select("id")
    .eq("baby_id", babyId)
    .eq("date", date)
    .eq("meal_moment_id", momentId)
    .maybeSingle();

  if (isEmpty) {
    if (existing) await supabase.from("meals").delete().eq("id", existing.id);
    revalidateApp();
    return;
  }

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
      })
      .select("id")
      .single();
    if (error || !created) return;
    mealId = created.id as string;
  } else {
    await supabase
      .from("meals")
      .update({ result: draft.result, note: draft.note.trim() || null })
      .eq("id", mealId);
  }

  // Remplacement complet des lignes liées
  await supabase.from("meal_items").delete().eq("meal_id", mealId);
  await supabase.from("meal_allergens").delete().eq("meal_id", mealId);
  await supabase.from("intake_observations").delete().eq("meal_id", mealId);

  if (draft.foodIds.length) {
    await supabase
      .from("meal_items")
      .insert(draft.foodIds.map((food_id) => ({ meal_id: mealId, food_id })));
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
    .select("date, meal_items(food_id), meal_allergens(allergen_id)")
    .eq("baby_id", babyId)
    .lte("date", dateISO);

  const foods: Record<string, number> = {};
  const allergens: Record<string, number> = {};
  for (const m of (data ?? []) as {
    meal_items: { food_id: string }[];
    meal_allergens: { allergen_id: string }[];
  }[]) {
    for (const it of m.meal_items ?? [])
      foods[it.food_id] = (foods[it.food_id] ?? 0) + 1;
    for (const a of m.meal_allergens ?? [])
      allergens[a.allergen_id] = (allergens[a.allergen_id] ?? 0) + 1;
  }
  return { foods, allergens };
}
