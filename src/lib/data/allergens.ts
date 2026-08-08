import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";

export type AllergenRow = {
  id: string;
  name: string;
  type: string | null;
  /** Libellé lisible de la fenêtre, dérivé des bornes chiffrées ci-dessous. */
  intro_window: string | null;
  note: string | null;
  /** Ordre d'introduction : force de la preuve, puis fréquence chez l'enfant. */
  intro_order: number | null;
  window_start_months: number | null;
  /** Borne haute : le générateur planifie à rebours depuis min(elle, 12 mois). */
  window_end_months: number | null;
  /** 'rct' = démontré par essai randomisé (arachide, œuf, lait). */
  evidence_level: string | null;
  starting_dose: string | null;
  target_dose: string | null;
  /** Expositions hebdomadaires visées après introduction. 0 = pas d'entretien. */
  maintenance_per_week: number;
  requires_medical_advice: boolean;
  household_id: string | null;
};

/** Catalogue d'allergènes visible par le foyer (commun + propres). */
const ALLERGEN_SELECT =
  "id, name, type, intro_window, note, intro_order, window_start_months, window_end_months, evidence_level, starting_dose, target_dose, maintenance_per_week, requires_medical_advice, household_id";

export async function getAllergens(): Promise<AllergenRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allergens")
    .select(ALLERGEN_SELECT)
    // L'ordre d'introduction fait foi ; le nom ne départage que les allergènes
    // ajoutés par le foyer, qui n'en ont pas.
    .order("intro_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  if (error) {
    console.error("getAllergens:", error.message);
    return [];
  }
  return data ?? [];
}

/**
 * Catalogue **commun** d'allergènes, lu sans session — donc appelable depuis une
 * page prérendue, là où `getAllergens` rendrait la route dynamique en lisant les
 * cookies. Les allergènes propres à un foyer sont invisibles ici : la RLS ne les
 * ouvre pas au rôle `anon` (cf. `createPublicClient`).
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
 * Expositions aux allergènes déclarées au rattrapage (onboarding), avec le drapeau
 * « réaction observée ». Complète les expositions déduites des repas passés.
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
