import { createClient } from "@/lib/supabase/server";

export type BabyRow = {
  id: string;
  prenom: string;
  date_naissance: string;
  date_terme: string | null;
  age_reference_date: string | null;
  household_id: string;
};

/** Le bébé du foyer courant (le premier, en attendant le multi-bébés). */
export async function getCurrentBaby(): Promise<BabyRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("babies")
    .select(
      "id, prenom, date_naissance, date_terme, age_reference_date, household_id",
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getCurrentBaby:", error.message);
    return null;
  }
  return data;
}
