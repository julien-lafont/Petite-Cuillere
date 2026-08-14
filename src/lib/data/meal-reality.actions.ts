"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { replanFrom, type ReplanResult } from "@/lib/data/program.actions";

/**
 * What the parent says about reality — and what the programme does with it.
 *
 * Every action here shares one rule: **save first, adjust after, never refuse**.
 * A parent whose entry is rejected stops entering, and that is the one sure way
 * to lose the tracking.
 *
 * Replanning only fires on a signal that genuinely changes the plan (meal not
 * given, composition replaced, absence announced). A "loved it", "mixed" or
 * "refused" rating on a meal that went as planned recomputes nothing: a refusal
 * does not shift the programme (decision G, R5).
 *
 * See docs/feats/suivi-reel-et-rattrapage.md §7.4.
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function revalidateApp() {
  revalidatePath("/", "layout");
}

/** Finds (or creates) the meal of a slot, and returns its id. */
async function ensureMeal(
  supabase: SupabaseClient,
  babyId: string,
  date: string,
  momentId: string,
): Promise<{ id: string; foodIds: string[] } | null> {
  const { data: existing } = await supabase
    .from("meals")
    .select("id, planned_food_ids, meal_items(food_id)")
    .eq("baby_id", babyId)
    .eq("date", date)
    .eq("meal_moment_id", momentId)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      foodIds:
        (existing.planned_food_ids as string[] | null) ??
        ((existing.meal_items ?? []) as { food_id: string }[]).map(
          (it) => it.food_id,
        ),
    };
  }

  const { data: created, error } = await supabase
    .from("meals")
    .insert({ baby_id: babyId, date, meal_moment_id: momentId })
    .select("id")
    .single();
  if (error || !created) return null;
  return { id: created.id as string, foodIds: [] };
}

/**
 * Realigns the allergen links with the meal's real composition.
 *
 * An orphan link — whose carrier food was removed — would suggest an exposure
 * that never happened. That is exactly the mistake this product may not make.
 */
async function syncMealAllergens(supabase: SupabaseClient, mealId: string) {
  const { data: items } = await supabase
    .from("meal_items")
    .select("food_id")
    .eq("meal_id", mealId)
    .eq("skipped", false);

  const foodIds = ((items ?? []) as { food_id: string }[]).map(
    (it) => it.food_id,
  );
  await supabase.from("meal_allergens").delete().eq("meal_id", mealId);
  if (foodIds.length === 0) return;

  const { data: carriers } = await supabase
    .from("foods")
    .select("allergen_id")
    .in("id", foodIds)
    .not("allergen_id", "is", null);

  const allergenIds = [
    ...new Set(
      ((carriers ?? []) as { allergen_id: string }[]).map((c) => c.allergen_id),
    ),
  ];
  if (allergenIds.length > 0) {
    await supabase
      .from("meal_allergens")
      .insert(
        allergenIds.map((allergen_id) => ({ meal_id: mealId, allergen_id })),
      );
  }
}

/**
 * "Not given" — a one-tap gesture from the day screen.
 *
 * The meal stays in the database with its composition: it says what was planned,
 * which is what lets us show it struck through and offer it again. Nothing is
 * lost, nothing counts as eaten.
 *
 * Setting it back to `false` undoes the gesture — there is no confirmation on
 * the way in, so there has to be a way back.
 */
export async function setMealSkipped(
  babyId: string,
  date: string,
  momentId: string,
  skipped: boolean,
): Promise<ReplanResult> {
  const supabase = await createClient();
  const meal = await ensureMeal(supabase, babyId, date, momentId);
  if (!meal) return { changedDays: 0, sentence: null };

  await supabase
    .from("meals")
    .update({
      status: skipped ? "saute" : "prevu",
      // A meal that was not given has nothing to rate: keeping "loved it" would
      // make no sense, and would skew the liking statistics.
      ...(skipped ? { result: null } : {}),
      logged_at: new Date().toISOString(),
      planned_food_ids: meal.foodIds.length > 0 ? meal.foodIds : null,
    })
    .eq("id", meal.id);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}

/**
 * "This meal is done" — the day thread's main gesture.
 *
 * Saying a meal happened and saying how it went are two different things: the
 * first is all the programme needs, the second is a bonus. `setMealResult` mixed
 * them — you had to pick an emoji to close a meal, so judge the child to fill in
 * the app. Here we confirm without rating; the rating comes later, on the
 * summary row, or never.
 *
 * No replanning: by definition nothing deviated.
 */
export async function setMealServed(
  babyId: string,
  date: string,
  momentId: string,
  served: boolean,
): Promise<void> {
  const supabase = await createClient();
  const meal = await ensureMeal(supabase, babyId, date, momentId);
  if (!meal) return;

  const { data: current } = await supabase
    .from("meals")
    .select("status")
    .eq("id", meal.id)
    .maybeSingle();

  await supabase
    .from("meals")
    .update({
      // Never downgrade a richer signal: a meal whose composition was corrected
      // stays "replaced", it has already happened.
      status: served
        ? current?.status === "remplace"
          ? "remplace"
          : "servi"
        : "prevu",
      // Going back puts the meal on hold again, rating included: a rating on a
      // meal that no longer happened means nothing.
      ...(served ? {} : { result: null }),
      logged_at: served ? new Date().toISOString() : null,
    })
    .eq("id", meal.id);

  revalidateApp();
}

/**
 * "He ate something else" — a meal's real composition.
 *
 * Locks the slot: the parent has told us what happened, the engine no longer
 * decides. Also covers an upcoming meal the parent composes themselves.
 */
export async function logMealFoods(
  babyId: string,
  date: string,
  momentId: string,
  foodIds: string[],
): Promise<ReplanResult> {
  const supabase = await createClient();
  const meal = await ensureMeal(supabase, babyId, date, momentId);
  if (!meal) return { changedDays: 0, sentence: null };

  const planned = [...meal.foodIds].sort();
  const actual = [...foodIds].sort();
  const sameAsPlanned =
    planned.length === actual.length &&
    actual.every((id, i) => id === planned[i]);

  // Doses and provenance of the kept foods: rewriting them flat would lose the
  // allergen protocol doses, which cannot be recomputed.
  const { data: priorItems } = await supabase
    .from("meal_items")
    .select("food_id, dose, source")
    .eq("meal_id", meal.id);
  const priorById = new Map(
    (
      (priorItems ?? []) as {
        food_id: string;
        dose: string | null;
        source: string;
      }[]
    ).map((it) => [it.food_id, it]),
  );

  await supabase
    .from("meals")
    .update({
      status: sameAsPlanned ? "servi" : "remplace",
      locked: true,
      logged_at: new Date().toISOString(),
      planned_food_ids: meal.foodIds.length > 0 ? meal.foodIds : null,
    })
    .eq("id", meal.id);

  await supabase.from("meal_items").delete().eq("meal_id", meal.id);
  if (foodIds.length > 0) {
    await supabase.from("meal_items").insert(
      foodIds.map((food_id) => {
        const prior = priorById.get(food_id);
        return {
          meal_id: meal.id,
          food_id,
          dose: prior?.dose ?? null,
          source: prior?.source ?? "parent",
          skipped: false,
        };
      }),
    );
  }

  // Allergens follow the foods actually served: that is the only honest source,
  // and an orphan link would suggest an exposure.
  await syncMealAllergens(supabase, meal.id);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}

/**
 * "It all went as planned" — the catch-up strip's bulk confirmation. One tap for
 * several days: this gesture is what makes tracking bearable for an overwhelmed
 * parent.
 *
 * Only touches meals left without a signal: a rating already given is the
 * authority. No replanning — by definition nothing deviated.
 *
 * **`toISO` must never reach the current day.** This button asserts that meals
 * happened; bounded at today, it would assert tonight's dinner. The catch-up
 * strip therefore stops at yesterday, and that is what spares this action from
 * knowing the household's clock and slots — it only ever faces whole days.
 */
export async function confirmMealsAsPlanned(
  babyId: string,
  fromISO: string,
  toISO: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("meals")
    .update({ status: "servi", logged_at: new Date().toISOString() })
    .eq("baby_id", babyId)
    .eq("status", "prevu")
    .gte("date", fromISO)
    .lte("date", toISO);

  revalidateApp();
}

/**
 * "We won't be there" — anticipation, the mirror of catch-up.
 *
 * The best signal is the one given ahead: the plan shifts before the problem
 * exists, and the shopping list with it.
 */
export async function setDayAbsent(
  babyId: string,
  date: string,
): Promise<ReplanResult> {
  const supabase = await createClient();
  await supabase
    .from("meals")
    .update({
      status: "saute",
      result: null,
      logged_at: new Date().toISOString(),
    })
    .eq("baby_id", babyId)
    .eq("date", date);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}

/**
 * "I don't have that" — swapping one food for another, before the meal.
 *
 * Corrects the same day, which replanning refuses to do on its own: here the
 * parent asks for it, on the meal in front of them. The slot is locked, and the
 * rest of the programme readjusts behind it.
 */
export async function substituteFood(
  babyId: string,
  date: string,
  momentId: string,
  fromFoodId: string,
  toFoodId: string,
): Promise<ReplanResult> {
  const supabase = await createClient();
  const meal = await ensureMeal(supabase, babyId, date, momentId);
  if (!meal) return { changedDays: 0, sentence: null };

  const { data: item } = await supabase
    .from("meal_items")
    .select("id")
    .eq("meal_id", meal.id)
    .eq("food_id", fromFoodId)
    .maybeSingle();
  if (!item) return { changedDays: 0, sentence: null };

  // The dose does not follow the food: it belonged to the protocol of the
  // replaced carrier. A substitute vegetable has no step to respect.
  await supabase
    .from("meal_items")
    .update({ food_id: toFoodId, dose: null, source: "parent", skipped: false })
    .eq("id", item.id);

  await supabase
    .from("meals")
    .update({
      locked: true,
      logged_at: new Date().toISOString(),
      planned_food_ids: meal.foodIds.length > 0 ? meal.foodIds : null,
    })
    .eq("id", meal.id);

  // Allergen links follow the real composition.
  await syncMealAllergens(supabase, meal.id);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}

/**
 * Confirms or denies that one particular food was given, while the rest of the
 * meal was. Exists only for the allergen protocol, where confirmation is safety
 * data — anywhere else this level of detail would not be worth an extra tap.
 */
export async function setItemSkipped(
  babyId: string,
  mealItemId: string,
  skipped: boolean,
): Promise<ReplanResult> {
  const supabase = await createClient();
  await supabase.from("meal_items").update({ skipped }).eq("id", mealItemId);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}
