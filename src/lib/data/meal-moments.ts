import { createClient } from "@/lib/supabase/server";
import type { TimedMoment } from "@/lib/moments";

/**
 * A meal moment: a name, and the window it occupies in the household's local day
 * (see docs/feats/creneaux-horaires.md).
 *
 * `position` is still here because half the code sorts on it, but it is
 * **derived** from `startMinute` since migration 0022: nobody writes it alone.
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
 * The household's meal moments, in the order of the day.
 *
 * Sorted on the start time rather than `position`: both say the same thing, but
 * the time is the source, and since two moments cannot overlap (exclusion
 * constraint) the ordering is total.
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
