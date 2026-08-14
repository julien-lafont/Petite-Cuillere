import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

export type AllergenRow = {
  id: string;
  name: string;
  type: string | null;
  /** Readable label for the window, derived from the numeric bounds below. */
  intro_window: string | null;
  /** Preparation and background notes. The allergens page does not show it. */
  note: string | null;
  /**
   * Safety instruction only — what hurts the child if ignored (choking, raw,
   * heavy metals). NULL = no danger of its own.
   */
  restrictions: string | null;
  /** Introduction order: strength of evidence, then how common in children. */
  intro_order: number | null;
  window_start_months: number | null;
  /** Upper bound: the generator plans backwards from min(it, 12 months). */
  window_end_months: number | null;
  /** 'rct' = shown by randomised trial (peanut, egg, milk). */
  evidence_level: string | null;
  starting_dose: string | null;
  target_dose: string | null;
  /** Weekly exposures targeted after introduction. 0 = no maintenance. */
  maintenance_per_week: number;
  requires_medical_advice: boolean;
  household_id: string | null;
};

/** Allergen catalogue visible to the household (common + its own). */
const ALLERGEN_SELECT =
  "id, name, type, intro_window, note, restrictions, intro_order, window_start_months, window_end_months, evidence_level, starting_dose, target_dose, maintenance_per_week, requires_medical_advice, household_id";

export async function getAllergens(): Promise<AllergenRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allergens")
    .select(ALLERGEN_SELECT)
    // Introduction order is the authority; the name only breaks ties between
    // allergens a household added, which have none.
    .order("intro_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("getAllergens:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * The **common** allergen catalogue, read without a session — so callable from a
 * prerendered page, where `getAllergens` would make the route dynamic by reading
 * cookies. Household-specific allergens are invisible here: RLS does not open
 * them to the `anon` role (see `createPublicClient`).
 */
export async function getPublicAllergens(): Promise<AllergenRow[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("allergens")
    .select(ALLERGEN_SELECT)
    .order("intro_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("getPublicAllergens:", error.message);
    return [];
  }
  return data ?? [];
}

export type AllergenIntroduction = {
  allergen_id: string;
  first_tried_on: string | null;
  had_reaction: boolean;
};

/**
 * Allergen exposures declared during onboarding catch-up, with the "reaction
 * observed" flag. Completes the exposures inferred from past meals.
 */
export async function getAllergenIntroductions(
  babyId: string,
): Promise<AllergenIntroduction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allergen_introductions")
    .select("allergen_id, first_tried_on, had_reaction")
    .eq("baby_id", babyId);

  if (error) {
    console.error("getAllergenIntroductions:", error.message);
    return [];
  }
  return data ?? [];
}
