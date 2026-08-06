import { createClient } from "@/lib/supabase/server";
import { addDays, toISODate } from "@/lib/dates";
import { buildWeekBriefing, type WeekBriefing } from "@/lib/program/stage";
import type { BabyRow } from "@/lib/data/baby";

type IntroductionRow = {
  first_tried_on: string | null;
  food: { name: string; category: string | null; is_allergen: boolean } | null;
};

/**
 * Le bandeau « où en est l'enfant » de la semaine se terminant le dimanche
 * `sundayISO` : stade de diversification, changements par rapport à la semaine
 * précédente, et découvertes réellement inscrites au programme.
 */
export async function getWeekBriefing(
  baby: BabyRow,
  momentLabels: string[],
  sundayISO: string,
): Promise<WeekBriefing> {
  const mondayISO = toISODate(addDays(new Date(`${sundayISO}T00:00:00`), -6));
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("food_introductions")
    .select("first_tried_on, food:foods(name, category, is_allergen)")
    .eq("baby_id", baby.id)
    .lte("first_tried_on", sundayISO)
    .order("first_tried_on", { ascending: true });

  if (error) console.error("getWeekBriefing:", error.message);

  // La matière grasse est ajoutée d'office par le générateur : la compter comme
  // une « découverte » brouillerait le message.
  const rows = ((data ?? []) as unknown as IntroductionRow[]).filter(
    (r) => r.food && r.food.category !== "matière grasse",
  );

  const discoveries = rows
    .filter((r) => r.first_tried_on && r.first_tried_on >= mondayISO)
    .map((r) => ({ name: r.food!.name, isAllergen: r.food!.is_allergen }));

  return buildWeekBriefing({
    babyName: baby.prenom,
    birthDate: baby.date_naissance,
    dueDate: baby.date_terme,
    ageReferenceDate: baby.age_reference_date,
    sundayISO,
    diversificationStartedOn: baby.diversification_started_on,
    momentLabels,
    discoveries,
    introducedTotal: rows.length,
  });
}
