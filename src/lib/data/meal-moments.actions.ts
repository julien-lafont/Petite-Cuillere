"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";

async function currentHouseholdId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("household_id")
    .single();
  return (data?.household_id as string) ?? null;
}

export async function addMealMoment(label: string) {
  if (!label.trim()) return;
  const supabase = await createClient();
  const hid = await currentHouseholdId(supabase);
  if (!hid) return;

  const { data: last } = await supabase
    .from("meal_moments")
    .select("position")
    .eq("household_id", hid)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const position = (last?.position ?? -1) + 1;

  await supabase
    .from("meal_moments")
    .insert({ household_id: hid, label: label.trim(), position });
  revalidatePath("/", "layout");
}

export async function renameMealMoment(id: string, label: string) {
  if (!label.trim()) return;
  const supabase = await createClient();
  await supabase
    .from("meal_moments")
    .update({ label: label.trim() })
    .eq("id", id);
  revalidatePath("/", "layout");
}

export async function removeMealMoment(id: string) {
  const supabase = await createClient();
  await supabase.from("meal_moments").delete().eq("id", id);
  revalidatePath("/", "layout");
}

/** Échange la position avec le moment voisin (up/down). */
export async function reorderMealMoment(id: string, direction: "up" | "down") {
  const supabase = await createClient();
  const hid = await currentHouseholdId(supabase);
  if (!hid) return;

  const { data: moments } = await supabase
    .from("meal_moments")
    .select("id, position")
    .eq("household_id", hid)
    .order("position", { ascending: true });
  if (!moments) return;

  const idx = moments.findIndex((m) => m.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= moments.length) return;

  const a = moments[idx];
  const b = moments[swapIdx];
  await supabase
    .from("meal_moments")
    .update({ position: b.position })
    .eq("id", a.id);
  await supabase
    .from("meal_moments")
    .update({ position: a.position })
    .eq("id", b.id);
  revalidatePath("/", "layout");
}
