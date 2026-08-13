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

/**
 * Données complètes recueillies par l'onboarding (cf. docs/ux-redesign.md §3) —
 * pour le premier enfant du foyer comme pour les suivants : c'est le seul
 * chemin de création d'un profil, et il génère toujours le programme.
 */
export type BabySetup = {
  prenom: string;
  dateNaissance: string;
  dateTerme?: string | null;
  /** Sexe de l'enfant (« fille » | « garcon »). */
  sexe?: string | null;
  /** Clé de la couleur de pastille choisie à l'onboarding. */
  avatarColor?: string | null;
  /** Jour de démarrage de la **génération** du programme (ISO). */
  startISO: string;
  /**
   * Date du premier aliment solide, si la diversification a déjà commencé.
   * Distincte de `startISO` : c'est elle qui mesure l'ancienneté, et donc la
   * vitesse à laquelle les repas s'ouvrent. NULL = tout commence maintenant.
   */
  diversificationStartedOn?: string | null;
  /** Eczéma sévère ou allergie à l'œuf connue → arachide sur avis médical. */
  atopicRisk?: boolean;
  /** Aliments déjà goûtés (rattrapage). */
  tastedFoodIds: string[];
  favoriteFoodId?: string | null;
  dislikedFoodId?: string | null;
  /** Allergènes déjà rencontrés, avec réaction observée ou non. */
  exposedAllergens: { allergenId: string; hadReaction: boolean }[];
};

const TOO_OLD_MESSAGE =
  "Petite Cuillère accompagne la diversification jusqu'au premier anniversaire.";

/**
 * Refus d'une date de naissance hors du domaine du produit, ou `null`.
 *
 * `ageEligibility` ne voit que le dépassement du premier anniversaire : une date
 * future y passe pour un nourrisson, et se traduit ensuite en un programme de
 * plusieurs siècles. Le contrôle client (`max` du sélecteur) est contournable,
 * et une faute de frappe suffit — 2226 pour 2026.
 *
 * Un jour de tolérance sur le futur : le serveur tourne en UTC, et un foyer en
 * avance sur lui verrait sinon refuser son propre aujourd'hui.
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
 * Crée le profil bébé, enregistre le rattrapage (aliments déjà goûtés, goûts,
 * allergènes rencontrés), puis génère le programme de diversification — le tout
 * sans qu'aucun bouton « générer » ne soit nécessaire (décision D2).
 *
 * Les aliments déjà goûtés sont datés de la veille du démarrage, ce qui les fait
 * considérer « déjà introduits » par le générateur (ils ne sont pas re-découverts,
 * mais réutilisés dans le roulement).
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

  // L'onboarding borne déjà la saisie, mais le contrôle client est contournable :
  // sans ce garde-fou on générerait un programme hors de son domaine de validité.
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
      // Sans date déclarée, la diversification commence avec le programme.
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

  // Rattrapage — aliments déjà goûtés, datés la veille du démarrage.
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

  // Rattrapage — allergènes rencontrés (tableau de bord de sécurité).
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

  // Génération immédiate du programme jusqu'au 1er anniversaire.
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
 * Fragment `date_terme` d'un insert/update. Flag prématurés désactivé → colonne
 * omise : les formulaires ne la saisissent plus, et on évite d'effacer un terme
 * déjà renseigné avant la bascule.
 */
function dateTermeColumn(dateTerme: string) {
  return FEATURE_PREMATURE_BABY_ENABLED
    ? { date_terme: dateTerme || null }
    : {};
}

/** Définit l'enfant actif (cookie, propre à cet appareil). */
export async function setActiveBaby(babyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BABY_COOKIE, babyId, ACTIVE_BABY_COOKIE_OPTS);
  revalidatePath("/", "layout");
}

/**
 * Supprime un enfant du foyer (et en cascade ses repas, introductions, etc.).
 * Si c'était l'enfant actif, bascule sur un enfant restant (ou vide le cookie
 * si c'était le dernier — l'onboarding réapparaît alors).
 */
export async function deleteBaby(babyId: string): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) return { error: "Foyer introuvable." };

  const { error } = await supabase.from("babies").delete().eq("id", babyId);
  if (error) {
    return {
      error: userMessage(
        "deleteBaby",
        error,
        "Impossible de supprimer ce profil.",
      ),
    };
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
 * Définit la date de référence de l'âge projeté du bébé (prématurés).
 * `isoDate` doit être entre la naissance et le terme ; null = valeur par défaut.
 * Sans le flag prématurés, l'âge projeté n'existe pas → no-op.
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
 * Met à jour le profil bébé (prénom, dates).
 *
 * Les mêmes contrôles qu'à la création : ce chemin mène au même générateur, et
 * c'est le seul par lequel une date de naissance peut encore changer.
 */
export async function updateBaby(
  babyId: string,
  prenom: string,
  dateNaissance: string,
  dateTerme: string,
  avatarColor?: string | null,
  sexe?: string | null,
  /** Premier repas solide. Vide = inchangé — on n'efface pas une date déjà posée. */
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
