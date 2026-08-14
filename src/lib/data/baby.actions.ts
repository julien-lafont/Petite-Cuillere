"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_BABY_COOKIE } from "@/lib/data/baby";
import { generateProgram } from "@/lib/data/program.actions";
import { ageEligibility, programDaysFrom } from "@/lib/age";
import { addDays, fromISODate, toISODate } from "@/lib/dates";
import { FEATURE_PREMATURE_BABY_ENABLED } from "@/lib/features";
import { resolveAvatarColor } from "@/lib/avatar-colors";
import { resolveSexe } from "@/lib/sexe";
import { normalizePrenom, MAX_PRENOM_LENGTH } from "@/lib/prenom";
import { userMessage } from "@/lib/data/errors";
import { DELETE_BABY_WORD, isDeleteBabyConfirmed } from "@/lib/baby-deletion";

/**
 * Everything the onboarding collects (see docs/ux-redesign.md §3) — for the
 * household's first child as well as the next ones: it is the only path that
 * creates a profile, and it always generates the programme.
 */
export type BabySetup = {
  prenom: string;
  dateNaissance: string;
  dateTerme?: string | null;
  /** The child's sex ("fille" | "garcon"). */
  sexe?: string | null;
  /** Key of the badge colour chosen at onboarding. */
  avatarColor?: string | null;
  /** Day the programme **generation** starts from (ISO). */
  startISO: string;
  /**
   * Date of the first solid food, if diversification has already started.
   * Distinct from `startISO`: this one measures how long they have been at it,
   * and so how fast meals open up. NULL = everything starts now.
   */
  diversificationStartedOn?: string | null;
  /** Severe eczema or known egg allergy → peanut on medical advice. */
  atopicRisk?: boolean;
  /** Foods already tasted (catch-up). */
  tastedFoodIds: string[];
  favoriteFoodId?: string | null;
  dislikedFoodId?: string | null;
  /** Allergens already met, with or without an observed reaction. */
  exposedAllergens: { allergenId: string; hadReaction: boolean }[];
};

const TOO_OLD_MESSAGE =
  "Petite Cuillère accompagne la diversification jusqu'au premier anniversaire.";

/**
 * Refusal for a birth date outside the product's scope, or `null`.
 *
 * `ageEligibility` only sees the first birthday being passed: a future date gets
 * through as a newborn, and then turns into a programme spanning centuries. The
 * client check (the picker's `max`) can be bypassed, and a typo is enough — 2226
 * for 2026.
 *
 * One day of slack into the future: the server runs in UTC, and a household
 * ahead of it would otherwise see its own today refused.
 */
function birthDateIssue(dateNaissance: string): string | null {
  const birth = fromISODate(dateNaissance);
  if (Number.isNaN(birth.getTime()))
    return "La date de naissance est invalide.";
  if (dateNaissance > toISODate(addDays(new Date(), 1))) {
    return "La date de naissance ne peut pas être dans le futur.";
  }
  if (ageEligibility(birth) === "too-old") return TOO_OLD_MESSAGE;
  return null;
}

/**
 * Creates the baby profile, records the catch-up (foods already tasted, likes,
 * allergens met), then generates the diversification programme — with no
 * "generate" button anywhere (decision D2).
 *
 * Foods already tasted are dated the day before the start, which makes the
 * generator treat them as already introduced: they are not re-discovered, but
 * reused in the rotation.
 */
export async function setupBaby(input: BabySetup): Promise<{ error?: string }> {
  const prenom = normalizePrenom(input.prenom);
  if (!prenom || !input.dateNaissance) {
    return { error: "Le prénom et la date de naissance sont requis." };
  }
  if (prenom.length > MAX_PRENOM_LENGTH) {
    return {
      error: `Le prénom ne peut pas dépasser ${MAX_PRENOM_LENGTH} caractères.`,
    };
  }

  // The onboarding already bounds the input, but the client check can be
  // bypassed: without this guard we would generate an out-of-scope programme.
  const issue = birthDateIssue(input.dateNaissance);
  if (issue) return { error: issue };

  const supabase = await createClient();
  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) return { error: "Foyer introuvable." };

  const { data: baby, error } = await supabase
    .from("babies")
    .insert({
      household_id: householdId,
      prenom,
      date_naissance: input.dateNaissance,
      sexe: resolveSexe(input.sexe),
      avatar_color: resolveAvatarColor(input.avatarColor),
      // With no declared date, diversification starts with the programme.
      diversification_started_on:
        input.diversificationStartedOn || input.startISO,
      atopic_risk: input.atopicRisk ?? false,
      ...dateTermeColumn(input.dateTerme ?? ""),
    })
    .select("id")
    .single();

  if (error || !baby) {
    return {
      error: userMessage("setupBaby", error, "Impossible de créer le profil."),
    };
  }
  const babyId = baby.id as string;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BABY_COOKIE, babyId, ACTIVE_BABY_COOKIE_OPTS);

  // Catch-up — foods already tasted, dated the day before the start.
  const introDate = toISODate(addDays(new Date(input.startISO), -1));
  if (input.tastedFoodIds.length > 0) {
    await supabase.from("food_introductions").upsert(
      input.tastedFoodIds.map((food_id) => ({
        baby_id: babyId,
        food_id,
        first_tried_on: introDate,
        liked:
          food_id === input.favoriteFoodId
            ? true
            : food_id === input.dislikedFoodId
              ? false
              : null,
      })),
      { onConflict: "baby_id,food_id" },
    );
  }

  // Catch-up — allergens met (safety dashboard).
  if (input.exposedAllergens.length > 0) {
    await supabase.from("allergen_introductions").upsert(
      input.exposedAllergens.map((a) => ({
        baby_id: babyId,
        allergen_id: a.allergenId,
        first_tried_on: introDate,
        had_reaction: a.hadReaction,
      })),
      { onConflict: "baby_id,allergen_id" },
    );
  }

  // Generate the programme up to the first birthday, right away.
  await generateProgram(
    babyId,
    input.startISO,
    programDaysFrom(input.dateNaissance, input.startISO),
  );

  revalidatePath("/", "layout");
  return {};
}

const ACTIVE_BABY_COOKIE_OPTS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax" as const,
};

/**
 * The `date_terme` fragment of an insert/update. With the premature flag off the
 * column is omitted: forms no longer capture it, and this avoids erasing a due
 * date recorded before the flip.
 */
function dateTermeColumn(dateTerme: string) {
  return FEATURE_PREMATURE_BABY_ENABLED
    ? { date_terme: dateTerme || null }
    : {};
}

/** Sets the active child (cookie, specific to this device). */
export async function setActiveBaby(babyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BABY_COOKIE, babyId, ACTIVE_BABY_COOKIE_OPTS);
  revalidatePath("/", "layout");
}

/**
 * Deletes a child from the household, and with them everything the database
 * holds about them — meals, tasted foods, allergens met all cascade away.
 * Nothing comes back, hence the two locks: the word the parent types, and RLS
 * reserving deletion to the household owner (migration 0030).
 *
 * If it was the active child, switches to a remaining one (or clears the cookie
 * if it was the last — the onboarding then reappears).
 */
export async function deleteBaby(
  babyId: string,
  confirmation: string,
): Promise<{ error?: string }> {
  // The input field already keeps the button closed; the check is repeated here
  // because a server action can be called without going through the screen.
  if (!isDeleteBabyConfirmed(confirmation)) {
    return {
      error: `Recopie « ${DELETE_BABY_WORD} » pour confirmer la suppression.`,
    };
  }

  const supabase = await createClient();
  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) return { error: "Foyer introuvable." };

  // A deletion RLS refuses is not an error: it simply matches no row. Without
  // counting what went, a helper's click would look like it erased the child.
  const { data: deleted, error } = await supabase
    .from("babies")
    .delete()
    .eq("id", babyId)
    .select("id");

  if (error) {
    return {
      error: userMessage(
        "deleteBaby",
        error,
        "Impossible de supprimer ce profil.",
      ),
    };
  }
  if (!deleted?.length) {
    return { error: "Seul le responsable du foyer peut supprimer un enfant." };
  }

  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_BABY_COOKIE)?.value === babyId) {
    const { data: remaining } = await supabase
      .from("babies")
      .select("id")
      .eq("household_id", householdId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (remaining) {
      cookieStore.set(
        ACTIVE_BABY_COOKIE,
        remaining.id,
        ACTIVE_BABY_COOKIE_OPTS,
      );
    } else {
      cookieStore.delete(ACTIVE_BABY_COOKIE);
    }
  }

  revalidatePath("/", "layout");
  return {};
}

/**
 * Sets the reference date for the baby's projected age (premature births).
 * `isoDate` must sit between birth and due date; null = the default value.
 * Without the premature flag there is no projected age → no-op.
 */
export async function setAgeReferenceDate(
  babyId: string,
  isoDate: string | null,
) {
  if (!FEATURE_PREMATURE_BABY_ENABLED) return;
  const supabase = await createClient();
  await supabase
    .from("babies")
    .update({ age_reference_date: isoDate })
    .eq("id", babyId);
  revalidatePath("/", "layout");
}

/**
 * Updates the baby profile (name, dates).
 *
 * Same checks as at creation: this path leads to the same generator, and it is
 * the only one through which a birth date can still change.
 */
export async function updateBaby(
  babyId: string,
  prenom: string,
  dateNaissance: string,
  dateTerme: string,
  avatarColor?: string | null,
  sexe?: string | null,
  /** First solid meal. Empty = unchanged — we do not erase a date already set. */
  diversificationStartedOn?: string,
): Promise<{ error?: string }> {
  const canonicalPrenom = normalizePrenom(prenom);
  if (!canonicalPrenom || canonicalPrenom.length > MAX_PRENOM_LENGTH) {
    return {
      error: `Le prénom ne peut pas dépasser ${MAX_PRENOM_LENGTH} caractères.`,
    };
  }
  if (!dateNaissance) return { error: "La date de naissance est requise." };
  const issue = birthDateIssue(dateNaissance);
  if (issue) return { error: issue };

  const supabase = await createClient();
  const { error } = await supabase
    .from("babies")
    .update({
      prenom: canonicalPrenom,
      date_naissance: dateNaissance,
      sexe: resolveSexe(sexe),
      avatar_color: resolveAvatarColor(avatarColor),
      ...(diversificationStartedOn
        ? { diversification_started_on: diversificationStartedOn }
        : {}),
      ...dateTermeColumn(dateTerme),
    })
    .eq("id", babyId);
  if (error) return { error: "Impossible d'enregistrer ces modifications." };

  revalidatePath("/", "layout");
  return {};
}
