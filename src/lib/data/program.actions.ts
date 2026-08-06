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
    .select(
      "date_naissance, date_terme, age_reference_date, diversification_started_on, atopic_risk",
    )
    .eq("id", babyId)
    .single();
  if (!baby) return;

  const [
    foodsRes,
    allergensRes,
    momentsRes,
    priorItemsRes,
    priorIntroRes,
    allergenIntroRes,
  ] = await Promise.all([
    supabase
      .from("foods")
      .select(
        "id, category, age_introduction_min, is_allergen, allergen_type, allergen_id, intro_order",
      ),
    supabase
      .from("allergens")
      .select(
        "id, name, type, intro_order, window_start_months, window_end_months, evidence_level, starting_dose, target_dose, maintenance_per_week, requires_medical_advice",
      ),
    supabase
      .from("meal_moments")
      .select("id, label, position")
      .order("position"),
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
    // Allergènes déjà connus : ceux déjà exposés passent directement en
    // entretien, ceux ayant provoqué une réaction sont retirés du programme.
    supabase
      .from("allergen_introductions")
      .select("allergen_id, had_reaction")
      .eq("baby_id", babyId),
  ]);

  const alreadyIntroduced = [
    ...new Set([
      ...((priorItemsRes.data ?? []) as { food_id: string }[]).map(
        (r) => r.food_id,
      ),
      ...((priorIntroRes.data ?? []) as { food_id: string }[]).map(
        (r) => r.food_id,
      ),
    ]),
  ];

  const priorAllergens = (allergenIntroRes.data ?? []) as {
    allergen_id: string;
    had_reaction: boolean;
  }[];

  const plan = buildPlan({
    birth: new Date(baby.date_naissance),
    due: baby.date_terme ? new Date(baby.date_terme) : null,
    ageRef: baby.age_reference_date ? new Date(baby.age_reference_date) : null,
    startISO,
    days,
    // L'ancienneté se compte depuis le premier aliment solide, pas depuis la
    // génération : régénérer un programme ne remet pas l'enfant à zéro.
    diversificationStartedOn: baby.diversification_started_on,
    atopicRisk: baby.atopic_risk ?? false,
    moments: momentsRes.data ?? [],
    foods: foodsRes.data ?? [],
    allergens: allergensRes.data ?? [],
    alreadyIntroduced,
    alreadyExposedAllergens: priorAllergens
      .filter((r) => !r.had_reaction)
      .map((r) => r.allergen_id),
    reactedAllergens: priorAllergens
      .filter((r) => r.had_reaction)
      .map((r) => r.allergen_id),
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

    const items: { meal_id: string; food_id: string; dose: string | null }[] =
      [];
    const mealAllergens: { meal_id: string; allergen_id: string }[] = [];
    for (const pm of plan.meals) {
      const id = idByKey.get(`${pm.date}|${pm.momentId}`);
      if (!id) continue;
      for (const it of pm.items)
        items.push({ meal_id: id, food_id: it.foodId, dose: it.dose });
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

  // Date de première exposition prévue pour chaque allergène : c'est ce qui
  // permet de dire au parent « 7 sur 16 introduits, tous dans leur fenêtre ».
  if (plan.allergenIntroductions.length > 0) {
    await supabase.from("allergen_introductions").upsert(
      plan.allergenIntroductions.map((i) => ({
        baby_id: babyId,
        allergen_id: i.allergenId,
        first_tried_on: i.date,
      })),
      { onConflict: "baby_id,allergen_id", ignoreDuplicates: true },
    );
  }

  revalidateApp();
}

function revalidateApp() {
  revalidatePath("/", "layout");
}
