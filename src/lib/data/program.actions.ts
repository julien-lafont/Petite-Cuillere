"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buildPlan, type Plan } from "@/lib/program/plan";
import { deriveState, type RealMeal } from "@/lib/program/reality";
import {
  comparePlans,
  diffSentence,
  sameComposition,
  type ComparableMeal,
} from "@/lib/program/diff";
import { programDaysFrom } from "@/lib/age";
import { addDays, toISODate } from "@/lib/dates";

/**
 * Génération et replanification du programme.
 *
 * Les deux passent par le même noyau : `buildPlan` est déterministe, et
 * replanifier n'est rien d'autre que le relancer depuis un jour donné avec un
 * état de départ enrichi du réel. Aucune logique incrémentale, donc aucun
 * risque de dérive entre les deux chemins.
 *
 * Ce qui les sépare tient en une phrase : la génération écrase, la
 * replanification compare (cf. docs/feats/suivi-reel-et-rattrapage.md §7.3).
 */

type BabyRow = {
  date_naissance: string;
  date_terme: string | null;
  age_reference_date: string | null;
  diversification_started_on: string | null;
  atopic_risk: boolean | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Repas existant, tel qu'il sert à la fois la dérivation du réel et le diff. */
type ExistingMeal = {
  id: string;
  date: string;
  meal_moment_id: string | null;
  status: "prevu" | "servi" | "remplace" | "saute";
  locked: boolean;
  result: "bien" | "moyen" | "refuse" | null;
  meal_items: { food_id: string; skipped: boolean; dose: string | null }[];
  meal_allergens: { allergen_id: string }[];
};

const EXISTING_SELECT =
  "id, date, meal_moment_id, status, locked, result, " +
  "meal_items(food_id, skipped, dose), meal_allergens(allergen_id)";

// ────────────────────────────────────────────────────────────────────────────
// Chargement
// ────────────────────────────────────────────────────────────────────────────

async function loadContext(supabase: SupabaseClient, babyId: string) {
  const { data: baby } = await supabase
    .from("babies")
    .select(
      "date_naissance, date_terme, age_reference_date, diversification_started_on, atopic_risk",
    )
    .eq("id", babyId)
    .single();
  if (!baby) return null;

  const [
    foodsRes,
    allergensRes,
    momentsRes,
    mealsRes,
    introRes,
    allergenIntroRes,
  ] = await Promise.all([
    supabase
      .from("foods")
      .select(
        "id, name, category, age_introduction_min, is_allergen, allergen_type, allergen_id, intro_order",
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
    // Toute l'histoire de l'enfant : c'est elle qui dit ce qu'il connaît, ce
    // qui lui reste à répéter, et ce que le parent a fixé lui-même.
    supabase.from("meals").select(EXISTING_SELECT).eq("baby_id", babyId),
    supabase
      .from("food_introductions")
      .select("food_id, first_tried_on")
      .eq("baby_id", babyId),
    // Allergènes déclarés au rattrapage : exposés (→ entretien) ou ayant
    // provoqué une réaction (→ retirés du programme).
    supabase
      .from("allergen_introductions")
      .select("allergen_id, had_reaction")
      .eq("baby_id", babyId),
  ]);

  const foods = (foodsRes.data ?? []) as ({ name: string } & Parameters<
    typeof buildPlan
  >[0]["foods"][number])[];

  return {
    baby: baby as BabyRow,
    foods,
    allergens: allergensRes.data ?? [],
    moments: momentsRes.data ?? [],
    meals: (mealsRes.data ?? []) as unknown as ExistingMeal[],
    introductions: (introRes.data ?? []) as {
      food_id: string;
      first_tried_on: string | null;
    }[],
    priorAllergens: (allergenIntroRes.data ?? []) as {
      allergen_id: string;
      had_reaction: boolean;
    }[],
  };
}

type Context = NonNullable<Awaited<ReturnType<typeof loadContext>>>;

/** Projette les repas de la base dans la forme attendue par `deriveState`. */
function toRealMeals(ctx: Context): RealMeal[] {
  const allergenByFood = new Map(ctx.foods.map((f) => [f.id, f.allergen_id]));
  return ctx.meals.map((m) => ({
    date: m.date,
    momentId: m.meal_moment_id,
    status: m.status,
    locked: m.locked,
    result: m.result,
    items: (m.meal_items ?? []).map((it) => ({
      foodId: it.food_id,
      skipped: it.skipped,
      allergenId: allergenByFood.get(it.food_id) ?? null,
      dose: it.dose,
    })),
    allergenIds: (m.meal_allergens ?? []).map((a) => a.allergen_id),
  }));
}

/** Construit le plan à partir du contexte, pour la période demandée. */
function planFrom(ctx: Context, fromISO: string, days: number): Plan {
  const state = deriveState(toRealMeals(ctx), fromISO, {
    // Les introductions déclarées au rattrapage n'ont pas de repas derrière
    // elles : sans cet apport, un aliment coché à l'inscription serait
    // redécouvert par le programme.
    priorIntroduced: ctx.introductions
      .filter((i) => !i.first_tried_on || i.first_tried_on < fromISO)
      .map((i) => i.food_id),
    priorAllergens: ctx.priorAllergens
      .filter((a) => !a.had_reaction)
      .map((a) => a.allergen_id),
    diversificationStartedOn: ctx.baby.diversification_started_on,
  });

  return buildPlan({
    birth: new Date(ctx.baby.date_naissance),
    due: ctx.baby.date_terme ? new Date(ctx.baby.date_terme) : null,
    ageRef: ctx.baby.age_reference_date
      ? new Date(ctx.baby.age_reference_date)
      : null,
    startISO: fromISO,
    days,
    // L'ancienneté se compte depuis le premier aliment solide, pas depuis la
    // génération : régénérer un programme ne remet pas l'enfant à zéro.
    diversificationStartedOn: ctx.baby.diversification_started_on,
    atopicRisk: ctx.baby.atopic_risk ?? false,
    moments: ctx.moments,
    foods: ctx.foods,
    allergens: ctx.allergens,
    alreadyIntroduced: state.introducedFoodIds,
    // Les allergènes abandonnés faute de confirmation rejoignent l'entretien :
    // le programme continue de les servir — donc d'exposer l'enfant — au lieu
    // de boucler indéfiniment sur une première fois qu'il ne saura jamais
    // vérifier (R6).
    alreadyExposedAllergens: [
      ...state.confirmedAllergenIds,
      ...state.unconfirmedGiveUpIds,
    ],
    reactedAllergens: ctx.priorAllergens
      .filter((a) => a.had_reaction)
      .map((a) => a.allergen_id),
    reality: state.reality,
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Écriture
// ────────────────────────────────────────────────────────────────────────────

const mealKey = (date: string, momentId: string | null) =>
  `${date}|${momentId}`;

/**
 * Un repas que le moteur n'a pas le droit de réécrire : le parent l'a composé,
 * ou il a dit qu'il n'aurait pas lieu. C'est la garantie qui rend la
 * replanification acceptable — sans elle, corriger un repas serait inutile
 * puisque le programme l'écraserait à la correction suivante.
 */
const isUntouchable = (m: ExistingMeal) => m.locked || m.status === "saute";

/**
 * Applique le plan sur la période, en ne touchant que ce qui change.
 *
 * `overwrite` distingue les deux usages : la génération initiale efface la
 * période (aucun réel à préserver), la replanification compare.
 */
async function writePlan(
  supabase: SupabaseClient,
  babyId: string,
  ctx: Context,
  plan: Plan,
  fromISO: string,
  endISO: string,
  overwrite: boolean,
) {
  const existing = ctx.meals.filter(
    (m) => m.date >= fromISO && m.date <= endISO && m.meal_moment_id,
  );
  const existingByKey = new Map(
    existing.map((m) => [mealKey(m.date, m.meal_moment_id), m]),
  );
  const plannedByKey = new Map(
    plan.meals.map((m) => [mealKey(m.date, m.momentId), m]),
  );

  // 1. Ce qui disparaît du programme. Un repas intouchable reste, même s'il
  //    n'est plus au plan : c'est une décision du parent, pas un résidu.
  const toDelete = existing
    .filter(
      (m) =>
        !isUntouchable(m) &&
        (overwrite || !plannedByKey.has(mealKey(m.date, m.meal_moment_id))),
    )
    .map((m) => m.id);
  if (toDelete.length > 0) {
    await supabase.from("meals").delete().in("id", toDelete);
  }
  const surviving = overwrite
    ? new Map<string, ExistingMeal>()
    : new Map([...existingByKey].filter(([, m]) => !toDelete.includes(m.id)));

  // 2. Ce qui entre ou change.
  const toInsert: { date: string; momentId: string }[] = [];
  const toRefill: { id: string; key: string }[] = [];

  for (const pm of plan.meals) {
    const key = mealKey(pm.date, pm.momentId);
    const current = surviving.get(key);
    if (!current) {
      toInsert.push({ date: pm.date, momentId: pm.momentId });
      continue;
    }
    if (isUntouchable(current)) continue;
    const before = (current.meal_items ?? []).map((it) => it.food_id);
    const after = pm.items.map((it) => it.foodId);
    // Composition identique : on laisse la ligne tranquille. C'est ce qui évite
    // de faire clignoter une grille dont 95 % des jours n'ont pas bougé.
    if (sameComposition(before, after)) continue;
    toRefill.push({ id: current.id, key });
  }

  const idByKey = new Map<string, string>();
  for (const [key, m] of surviving) idByKey.set(key, m.id);

  if (toInsert.length > 0) {
    const { data: inserted } = await supabase
      .from("meals")
      .insert(
        toInsert.map((m) => ({
          baby_id: babyId,
          date: m.date,
          meal_moment_id: m.momentId,
        })),
      )
      .select("id, date, meal_moment_id");
    for (const m of inserted ?? []) {
      idByKey.set(
        mealKey(m.date as string, m.meal_moment_id as string),
        m.id as string,
      );
    }
  }

  // 3. Contenu des repas neufs ou modifiés.
  const refillIds = toRefill.map((r) => r.id);
  if (refillIds.length > 0) {
    await supabase.from("meal_items").delete().in("meal_id", refillIds);
    await supabase.from("meal_allergens").delete().in("meal_id", refillIds);
  }

  const touchedKeys = new Set([
    ...toInsert.map((m) => mealKey(m.date, m.momentId)),
    ...toRefill.map((r) => r.key),
  ]);

  const items: {
    meal_id: string;
    food_id: string;
    dose: string | null;
    source: string;
  }[] = [];
  const mealAllergens: { meal_id: string; allergen_id: string }[] = [];
  for (const pm of plan.meals) {
    const key = mealKey(pm.date, pm.momentId);
    if (!touchedKeys.has(key)) continue;
    const id = idByKey.get(key);
    if (!id) continue;
    for (const it of pm.items) {
      items.push({
        meal_id: id,
        food_id: it.foodId,
        dose: it.dose,
        source: "programme",
      });
    }
    for (const aid of pm.allergenIds) {
      mealAllergens.push({ meal_id: id, allergen_id: aid });
    }
  }
  if (items.length) await supabase.from("meal_items").insert(items);
  if (mealAllergens.length)
    await supabase.from("meal_allergens").insert(mealAllergens);

  // 4. Dates de première exposition prévues. On ne réécrit que l'avenir : une
  //    introduction réelle, déjà datée dans le passé, n'a pas à bouger.
  await supabase
    .from("food_introductions")
    .delete()
    .eq("baby_id", babyId)
    .gte("first_tried_on", fromISO);

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
}

// ────────────────────────────────────────────────────────────────────────────
// Actions
// ────────────────────────────────────────────────────────────────────────────

/**
 * Génère le programme de diversification sur `durationDays` jours à partir de
 * `startISO`. Écrase la période — sauf les repas que le parent a fixés
 * lui-même, qui survivent à une régénération comme à une replanification.
 */
export async function generateProgram(
  babyId: string,
  startISO: string,
  durationDays: number,
) {
  const days = Math.min(400, Math.max(1, Math.round(durationDays)));
  const supabase = await createClient();
  const ctx = await loadContext(supabase, babyId);
  if (!ctx) return;

  const plan = planFrom(ctx, startISO, days);
  // buildPlan couvre les jours 0..days-1 : la borne évite d'effacer le jour
  // juste après la période (ex. le lundi suivant).
  const endISO = toISODate(addDays(new Date(startISO), days - 1));

  await writePlan(supabase, babyId, ctx, plan, startISO, endISO, true);
  revalidateApp();
}

/** Ce que la replanification a changé, mis en phrase pour le parent. */
export type ReplanResult = {
  changedDays: number;
  /** Phrase à afficher, ou `null` s'il n'y a rien à dire. */
  sentence: string | null;
};

/**
 * Replanifie le reste du programme à partir de `fromISO`, en tenant compte de
 * tout ce qui s'est réellement passé avant.
 *
 * Ne touche jamais au passé ni au jour même : le parent a peut-être déjà
 * acheté, cuisiné, ou lu la fiche du jour. Par défaut, on repart donc de
 * demain.
 */
export async function replanFrom(
  babyId: string,
  fromISO?: string,
): Promise<ReplanResult> {
  const supabase = await createClient();
  const ctx = await loadContext(supabase, babyId);
  if (!ctx) return { changedDays: 0, sentence: null };

  const tomorrow = toISODate(addDays(new Date(), 1));
  const start = fromISO && fromISO > tomorrow ? fromISO : tomorrow;
  const days = programDaysFrom(ctx.baby.date_naissance, start);
  const endISO = toISODate(addDays(new Date(`${start}T00:00:00`), days - 1));

  const before: ComparableMeal[] = ctx.meals
    .filter((m) => m.date >= start && m.date <= endISO && m.meal_moment_id)
    .map((m) => ({
      date: m.date,
      momentId: m.meal_moment_id!,
      foodIds: (m.meal_items ?? []).map((it) => it.food_id),
    }));

  const plan = planFrom(ctx, start, days);
  const after: ComparableMeal[] = plan.meals.map((m) => ({
    date: m.date,
    momentId: m.momentId,
    foodIds: m.items.map((it) => it.foodId),
  }));

  await writePlan(supabase, babyId, ctx, plan, start, endISO, false);

  const nameById = new Map(ctx.foods.map((f) => [f.id, f.name]));
  const diff = comparePlans(before, after, (id) => nameById.get(id) ?? null);

  // La découverte que le réel impose de reproposer : c'est la seule chose que
  // le parent a besoin d'entendre, et elle prime sur le décompte des jours.
  const state = deriveState(toRealMeals(ctx), start, {
    diversificationStartedOn: ctx.baby.diversification_started_on,
  });
  if (state.reality.repeatToday) {
    diff.repeatedFood = nameById.get(state.reality.repeatToday) ?? undefined;
  }

  revalidateApp();
  return { changedDays: diff.changedDays, sentence: diffSentence(diff) };
}

function revalidateApp() {
  revalidatePath("/", "layout");
}
