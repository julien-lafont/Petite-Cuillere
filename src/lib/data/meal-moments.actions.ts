"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { windowIssue, type TimedMoment } from "@/lib/moments";
import { TEXT_LIMITS, tooLongMessage } from "@/lib/limits";

/**
 * L'édition des moments de repas — écran caché derrière `FEATURE_CUSTOM_MEALS`.
 *
 * Depuis que le moment porte un créneau, l'ordre n'est plus une donnée qu'on
 * saisit : il se déduit de l'heure de début. `reorderMealMoment` a donc disparu,
 * et `position` est recalculée après chaque écriture.
 *
 * Les deux garde-fous (fin après début, pas de chevauchement) existent en trois
 * exemplaires : dans le formulaire, ici, et en base. Le dernier est le seul qui
 * fasse foi ; les deux premiers servent à dire **quoi** corriger, ce qu'une
 * violation de contrainte ne sait pas faire.
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

/** `position` suit l'heure de début. Appelée après toute écriture. */
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

/** Le nom du moment est le seul texte libre de cet écran. */
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
  if (error) return { error: error.message };

  await renumber(supabase, hid);
  revalidatePath("/", "layout");
  return {};
}

/** Renomme et/ou redéfinit le créneau — c'est la même écriture. */
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
  if (error) return { error: error.message };

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
  // Un foyer sans moment n'a plus de journée : l'écran du jour serait vide et
  // le générateur n'aurait plus où poser un repas.
  if (rows.length <= 1) {
    return { error: "Gardez au moins un moment de repas." };
  }

  const { error } = await supabase.from("meal_moments").delete().eq("id", id);
  if (error) return { error: error.message };

  await renumber(supabase, hid);
  revalidatePath("/", "layout");
  return {};
}
