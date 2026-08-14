"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { windowIssue, type TimedMoment } from "@/lib/moments";
import { TEXT_LIMITS, tooLongMessage } from "@/lib/limits";
import { userMessage } from "@/lib/data/errors";

/**
 * Editing meal moments — a screen behind `FEATURE_CUSTOM_MEALS`.
 *
 * Now that a moment carries a window, order is no longer something you enter: it
 * follows from the start time. `reorderMealMoment` is therefore gone, and
 * `position` is recomputed after every write.
 *
 * The two guards (end after start, no overlap) exist in triplicate: in the form,
 * here, and in the database. Only the last is the authority; the first two say
 * **what** to fix, which a constraint violation cannot.
 */

async function currentHouseholdId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase.rpc("current_household_id");
  return (data as string) ?? null;
}

type MomentRow = {
  id: string;
  label: string;
  position: number;
  start_minute: number;
  end_minute: number;
};

async function momentsOf(
  supabase: SupabaseClient,
  householdId: string,
): Promise<MomentRow[]> {
  const { data } = await supabase
    .from("meal_moments")
    .select("id, label, position, start_minute, end_minute")
    .eq("household_id", householdId)
    .order("start_minute", { ascending: true });
  return (data ?? []) as MomentRow[];
}

function timed(rows: MomentRow[], exceptId?: string): TimedMoment[] {
  return rows
    .filter((row) => row.id !== exceptId)
    .map((row) => ({
      id: row.id,
      label: row.label,
      startMinute: row.start_minute,
      endMinute: row.end_minute,
    }));
}

/** `position` follows the start time. Called after every write. */
async function renumber(supabase: SupabaseClient, householdId: string) {
  const rows = await momentsOf(supabase, householdId);
  await Promise.all(
    rows.map((row, index) =>
      row.position === index
        ? Promise.resolve()
        : supabase
            .from("meal_moments")
            .update({ position: index })
            .eq("id", row.id),
    ),
  );
}

/** The moment's name is the only free text on this screen. */
function labelIssue(label: string): string | null {
  if (!label.trim()) return "Donnez un nom à ce moment.";
  return tooLongMessage([["Le nom", label.trim(), TEXT_LIMITS.momentLabel]]);
}

export type MomentActionResult = { error?: string };

export async function addMealMoment(
  label: string,
  startMinute: number,
  endMinute: number,
): Promise<MomentActionResult> {
  const named = labelIssue(label);
  if (named) return { error: named };
  const supabase = await createClient();
  const hid = await currentHouseholdId(supabase);
  if (!hid) return { error: "Foyer introuvable." };

  const rows = await momentsOf(supabase, hid);
  const issue = windowIssue({ startMinute, endMinute }, timed(rows));
  if (issue) return { error: issue };

  const { error } = await supabase.from("meal_moments").insert({
    household_id: hid,
    label: label.trim(),
    position: rows.length,
    start_minute: startMinute,
    end_minute: endMinute,
  });
  if (error) {
    return {
      error: userMessage(
        "addMealMoment",
        error,
        "Impossible d'ajouter ce moment.",
      ),
    };
  }

  await renumber(supabase, hid);
  revalidatePath("/", "layout");
  return {};
}

/** Renames and/or redefines the window — it is the same write. */
export async function updateMealMoment(
  id: string,
  label: string,
  startMinute: number,
  endMinute: number,
): Promise<MomentActionResult> {
  const named = labelIssue(label);
  if (named) return { error: named };
  const supabase = await createClient();
  const hid = await currentHouseholdId(supabase);
  if (!hid) return { error: "Foyer introuvable." };

  const rows = await momentsOf(supabase, hid);
  const issue = windowIssue({ startMinute, endMinute }, timed(rows, id));
  if (issue) return { error: issue };

  const { error } = await supabase
    .from("meal_moments")
    .update({
      label: label.trim(),
      start_minute: startMinute,
      end_minute: endMinute,
    })
    .eq("id", id);
  if (error) {
    return {
      error: userMessage(
        "updateMealMoment",
        error,
        "Impossible d'enregistrer ce moment.",
      ),
    };
  }

  await renumber(supabase, hid);
  revalidatePath("/", "layout");
  return {};
}

export async function removeMealMoment(
  id: string,
): Promise<MomentActionResult> {
  const supabase = await createClient();
  const hid = await currentHouseholdId(supabase);
  if (!hid) return { error: "Foyer introuvable." };

  const rows = await momentsOf(supabase, hid);
  // A household with no moment has no day left: the day screen would be empty
  // and the generator would have nowhere to put a meal.
  if (rows.length <= 1) {
    return { error: "Gardez au moins un moment de repas." };
  }

  const { error } = await supabase.from("meal_moments").delete().eq("id", id);
  if (error) {
    return {
      error: userMessage(
        "removeMealMoment",
        error,
        "Impossible de supprimer ce moment.",
      ),
    };
  }

  await renumber(supabase, hid);
  revalidatePath("/", "layout");
  return {};
}
