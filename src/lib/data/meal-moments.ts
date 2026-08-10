import { createClient } from "@/lib/supabase/server";
import type { TimedMoment } from "@/lib/moments";

/**
 * Un moment de repas : un nom, et le créneau qu'il occupe dans la journée
 * locale du foyer (cf. docs/feats/creneaux-horaires.md).
 *
 * `position` reste là parce que la moitié du code trie dessus, mais elle est
 * **dérivée** de `startMinute` depuis la migration 0022 : personne ne l'écrit
 * seule.
 */
export type MealMoment = TimedMoment & {
  position: number;
};

const MOMENT_SELECT = "id, label, position, start_minute, end_minute";

type MomentRow = {
  id: string;
  label: string;
  position: number;
  start_minute: number;
  end_minute: number;
};

function toMoment(row: MomentRow): MealMoment {
  return {
    id: row.id,
    label: row.label,
    position: row.position,
    startMinute: row.start_minute,
    endMinute: row.end_minute,
  };
}

/**
 * Moments de repas du foyer, dans l'ordre de la journée.
 *
 * Le tri se fait sur l'heure de début et non sur `position` : les deux disent
 * la même chose, mais l'heure est la source, et deux moments ne pouvant pas se
 * chevaucher (contrainte d'exclusion), l'ordre est total.
 */
export async function getMealMoments(): Promise<MealMoment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_moments")
    .select(MOMENT_SELECT)
    .order("start_minute", { ascending: true });

  if (error) {
    console.error("getMealMoments:", error.message);
    return [];
  }
  return ((data ?? []) as MomentRow[]).map(toMoment);
}
