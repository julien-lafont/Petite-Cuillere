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
import { MAX_PROGRAM_DAYS, programDaysFrom } from "@/lib/age";
import { addDays, toISODate } from "@/lib/dates";

/**
 * Programme generation and replanning.
 *
 * Both go through the same core: `buildPlan` is deterministic, and replanning is
 * nothing but running it again from a given day with a start state enriched by
 * reality. No incremental logic, so no risk of the two paths drifting apart.
 *
 * What separates them fits in a sentence: generation overwrites, replanning
 * compares (see docs/feats/suivi-reel-et-rattrapage.md §7.3).
 */

type BabyRow = {
  date_naissance: string;
  date_terme: string | null;
  age_reference_date: string | null;
  diversification_started_on: string | null;
  atopic_risk: boolean | null;
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** An existing meal, in the shape that serves both deriving reality and the diff. */
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
    // The generator's order is the day's, so the clock's: `position` is derived
    // from it, but the source is the authority (see migration 0022).
    supabase
      .from("meal_moments")
      .select("id, label, position")
      .order("start_minute"),
    // The child's whole history: it says what they know, what they still have
    // to repeat, and what the parent fixed themselves.
    supabase.from("meals").select(EXISTING_SELECT).eq("baby_id", babyId),
    supabase
      .from("food_introductions")
      .select("food_id, first_tried_on")
      .eq("baby_id", babyId),
    // Allergens declared at catch-up: exposed (→ maintenance) or having caused
    // a reaction (→ removed from the programme). The table also holds the
    // *planned* exposure dates written by `saveProgram`: hence the date, which
    // alone lets us set them aside (see `planFrom`).
    supabase
      .from("allergen_introductions")
      .select("allergen_id, first_tried_on, had_reaction")
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
      first_tried_on: string | null;
      had_reaction: boolean;
    }[],
  };
}

type Context = NonNullable<Awaited<ReturnType<typeof loadContext>>>;

/** Projects database meals into the shape `deriveState` expects. */
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

/** Builds the plan from the context, for the requested period. */
function planFrom(ctx: Context, fromISO: string, days: number): Plan {
  const state = deriveState(toRealMeals(ctx), fromISO, {
    // Introductions declared at catch-up have no meal behind them: without this
    // input, a food ticked at sign-up would be rediscovered by the programme.
    priorIntroduced: ctx.introductions
      .filter((i) => !i.first_tried_on || i.first_tried_on < fromISO)
      .map((i) => i.food_id),
    // Same care as for foods: a row dated after `fromISO` is an exposure
    // *planned* by an earlier generation, not one that was lived. Keeping it
    // would make the programme skip the very first time it has just written
    // into its own calendar.
    priorAllergens: ctx.priorAllergens
      .filter(
        (a) =>
          !a.had_reaction && (!a.first_tried_on || a.first_tried_on < fromISO),
      )
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
    // Elapsed time counts from the first solid food, not from generation:
    // regenerating a programme does not reset the child.
    diversificationStartedOn: ctx.baby.diversification_started_on,
    atopicRisk: ctx.baby.atopic_risk ?? false,
    moments: ctx.moments,
    foods: ctx.foods,
    allergens: ctx.allergens,
    alreadyIntroduced: state.introducedFoodIds,
    // Allergens dropped for lack of confirmation join maintenance: the
    // programme keeps serving them — so keeps exposing the child — instead of
    // looping forever on a first time it will never get to verify (R6).
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
 * A meal the engine may not rewrite: the parent composed it, or said it would
 * not happen. This guarantee is what makes replanning acceptable — without it,
 * correcting a meal would be pointless since the programme would overwrite it on
 * the next correction.
 */
const isUntouchable = (m: ExistingMeal) => m.locked || m.status === "saute";

/**
 * Applies the plan over the period, touching only what changes.
 *
 * `overwrite` separates the two uses: initial generation wipes the period (there
 * is no reality to preserve), replanning compares.
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

  // 1. What leaves the programme. An untouchable meal stays, even when it is no
  //    longer in the plan: it is the parent's decision, not a leftover.
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

  // 2. What comes in or changes.
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
    // Same composition: leave the row alone. That is what stops a grid whose
    // days are 95 % unchanged from flickering.
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

  // 3. Contents of the new or changed meals.
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

  // 4. Planned first-exposure dates. We only rewrite the future: a real
  //    introduction, already dated in the past, must not move.
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

  // Planned first-exposure date for each allergen: that is what lets us tell
  // the parent "7 of 16 introduced, all inside their window".
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
 * Generates the diversification programme over `durationDays` days from
 * `startISO`. Overwrites the period — except the meals the parent fixed
 * themselves, which survive a regeneration as they survive a replan.
 */
export async function generateProgram(
  babyId: string,
  startISO: string,
  durationDays: number,
) {
  const days = Math.min(
    MAX_PROGRAM_DAYS,
    Math.max(1, Math.round(durationDays)),
  );
  const supabase = await createClient();
  const ctx = await loadContext(supabase, babyId);
  if (!ctx) return;

  const plan = planFrom(ctx, startISO, days);
  // buildPlan covers days 0..days-1: the bound avoids erasing the day just
  // after the period (the following Monday, say).
  const endISO = toISODate(addDays(new Date(startISO), days - 1));

  await writePlan(supabase, babyId, ctx, plan, startISO, endISO, true);
  revalidateApp();
}

/** What replanning changed, put into a sentence for the parent. */
export type ReplanResult = {
  changedDays: number;
  /** Sentence to display, or `null` when there is nothing to say. */
  sentence: string | null;
};

/**
 * Replans the rest of the programme from `fromISO`, taking into account
 * everything that actually happened before.
 *
 * Never touches the past nor the current day: the parent may already have
 * shopped, cooked, or read today's card. So by default we start again from
 * tomorrow.
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

  // The discovery reality forces us to offer again: it is the only thing the
  // parent needs to hear, and it beats the day count.
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
