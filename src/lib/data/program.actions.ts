"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildPlan } from "@/lib/program/plan";
import { addDays, toISODate } from "@/lib/dates";

/**
 * Génère le programme de diversification sur `months` mois à partir de `startISO`.
 * Écrase la période existante (choix validé) puis écrit en lots.
 */
export async function generateProgram(
  babyId: string,
  startISO: string,
  durationDays: number,
) {
  const days = Math.min(400, Math.max(1, Math.round(durationDays)));
  const supabase = await createClient();

  const { data: baby } = await supabase
    .from("babies")
    .select("date_naissance, date_terme, age_reference_date")
    .eq("id", babyId)
    .single();
  if (!baby) return;

  const [foodsRes, allergensRes, momentsRes, priorItemsRes, priorIntroRes] =
    await Promise.all([
      supabase
        .from("foods")
        .select(
          "id, category, age_introduction_min, is_allergen, allergen_type, intro_order",
        ),
      supabase.from("allergens").select("id, name"),
      supabase.from("meal_moments").select("id, label, position").order("position"),
      // Aliments déjà mangés AVANT le démarrage (repas antérieurs)
      supabase
        .from("meal_items")
        .select("food_id, meals!inner(date, baby_id)")
        .eq("meals.baby_id", babyId)
        .lt("meals.date", startISO),
      // + introductions déjà enregistrées avant le démarrage
      supabase
        .from("food_introductions")
        .select("food_id")
        .eq("baby_id", babyId)
        .lt("first_tried_on", startISO),
    ]);

  const alreadyIntroduced = [
    ...new Set([
      ...((priorItemsRes.data ?? []) as { food_id: string }[]).map((r) => r.food_id),
      ...((priorIntroRes.data ?? []) as { food_id: string }[]).map((r) => r.food_id),
    ]),
  ];

  const plan = buildPlan({
    birth: new Date(baby.date_naissance),
    due: baby.date_terme ? new Date(baby.date_terme) : null,
    ageRef: baby.age_reference_date ? new Date(baby.age_reference_date) : null,
    startISO,
    days,
    moments: momentsRes.data ?? [],
    foods: foodsRes.data ?? [],
    allergens: allergensRes.data ?? [],
    alreadyIntroduced,
  });

  // Dernier jour généré (buildPlan couvre les jours 0..days-1) → évite d'effacer
  // le jour juste après la période (ex. le lundi suivant).
  const endISO = toISODate(addDays(new Date(startISO), days - 1));

  // Écrase la période
  await supabase
    .from("meals")
    .delete()
    .eq("baby_id", babyId)
    .gte("date", startISO)
    .lte("date", endISO);
  await supabase
    .from("food_introductions")
    .delete()
    .eq("baby_id", babyId)
    .gte("first_tried_on", startISO);

  if (plan.meals.length > 0) {
    const { data: inserted } = await supabase
      .from("meals")
      .insert(
        plan.meals.map((m) => ({
          baby_id: babyId,
          date: m.date,
          meal_moment_id: m.momentId,
        })),
      )
      .select("id, date, meal_moment_id");

    const idByKey = new Map<string, string>();
    for (const m of inserted ?? []) {
      idByKey.set(`${m.date}|${m.meal_moment_id}`, m.id as string);
    }

    const items: { meal_id: string; food_id: string }[] = [];
    const mealAllergens: { meal_id: string; allergen_id: string }[] = [];
    for (const pm of plan.meals) {
      const id = idByKey.get(`${pm.date}|${pm.momentId}`);
      if (!id) continue;
      for (const fid of pm.foodIds) items.push({ meal_id: id, food_id: fid });
      for (const aid of pm.allergenIds)
        mealAllergens.push({ meal_id: id, allergen_id: aid });
    }
    if (items.length) await supabase.from("meal_items").insert(items);
    if (mealAllergens.length)
      await supabase.from("meal_allergens").insert(mealAllergens);
  }

  if (plan.introductions.length > 0) {
    await supabase.from("food_introductions").upsert(
      plan.introductions.map((i) => ({
        baby_id: babyId,
        food_id: i.foodId,
        first_tried_on: i.date,
      })),
      { onConflict: "baby_id,food_id" },
    );
  }

  revalidateApp();
}

function revalidateApp() {
  revalidatePath("/", "layout");
}
