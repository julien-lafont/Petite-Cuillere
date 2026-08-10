"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { replanFrom, type ReplanResult } from "@/lib/data/program.actions";

/**
 * Ce que le parent dit du réel — et ce que le programme en fait.
 *
 * Toutes ces actions partagent la même règle : **enregistrer d'abord, ajuster
 * ensuite, ne jamais refuser**. Un parent dont la saisie est rejetée cesse de
 * saisir, et c'est la seule façon certaine de perdre le suivi.
 *
 * La replanification n'est déclenchée que par un signal qui change vraiment le
 * plan (repas non donné, composition remplacée, absence annoncée). Une note
 * « adoré », « moyen » ou « refusé » sur un repas conforme ne recalcule rien :
 * un refus ne décale pas le programme (décision G, R5).
 *
 * Cf. docs/feats/suivi-reel-et-rattrapage.md §7.4.
 */

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function revalidateApp() {
  revalidatePath("/", "layout");
}

/** Retrouve (ou crée) le repas d'un créneau, et renvoie son identifiant. */
async function ensureMeal(
  supabase: SupabaseClient,
  babyId: string,
  date: string,
  momentId: string,
): Promise<{ id: string; foodIds: string[] } | null> {
  const { data: existing } = await supabase
    .from("meals")
    .select("id, planned_food_ids, meal_items(food_id)")
    .eq("baby_id", babyId)
    .eq("date", date)
    .eq("meal_moment_id", momentId)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      foodIds:
        (existing.planned_food_ids as string[] | null) ??
        ((existing.meal_items ?? []) as { food_id: string }[]).map(
          (it) => it.food_id,
        ),
    };
  }

  const { data: created, error } = await supabase
    .from("meals")
    .insert({ baby_id: babyId, date, meal_moment_id: momentId })
    .select("id")
    .single();
  if (error || !created) return null;
  return { id: created.id as string, foodIds: [] };
}

/**
 * Recale les liens d'allergènes sur la composition réelle du repas.
 *
 * Un lien orphelin — dont l'aliment porteur a été retiré — ferait croire à une
 * exposition qui n'a pas eu lieu. C'est exactement l'erreur que le produit n'a
 * pas le droit de commettre.
 */
async function syncMealAllergens(supabase: SupabaseClient, mealId: string) {
  const { data: items } = await supabase
    .from("meal_items")
    .select("food_id")
    .eq("meal_id", mealId)
    .eq("skipped", false);

  const foodIds = ((items ?? []) as { food_id: string }[]).map(
    (it) => it.food_id,
  );
  await supabase.from("meal_allergens").delete().eq("meal_id", mealId);
  if (foodIds.length === 0) return;

  const { data: carriers } = await supabase
    .from("foods")
    .select("allergen_id")
    .in("id", foodIds)
    .not("allergen_id", "is", null);

  const allergenIds = [
    ...new Set(
      ((carriers ?? []) as { allergen_id: string }[]).map((c) => c.allergen_id),
    ),
  ];
  if (allergenIds.length > 0) {
    await supabase
      .from("meal_allergens")
      .insert(
        allergenIds.map((allergen_id) => ({ meal_id: mealId, allergen_id })),
      );
  }
}

/**
 * « Pas donné » — le geste à un tap de l'écran du jour.
 *
 * Le repas reste en base avec sa composition : elle dit ce qui était prévu, ce
 * qui permet de l'afficher barré et de le reproposer. Rien n'est perdu, rien
 * n'est compté comme mangé.
 *
 * Repasser à `false` annule le geste — il n'y a pas de confirmation à l'aller,
 * il faut donc un retour possible.
 */
export async function setMealSkipped(
  babyId: string,
  date: string,
  momentId: string,
  skipped: boolean,
): Promise<ReplanResult> {
  const supabase = await createClient();
  const meal = await ensureMeal(supabase, babyId, date, momentId);
  if (!meal) return { changedDays: 0, sentence: null };

  await supabase
    .from("meals")
    .update({
      status: skipped ? "saute" : "prevu",
      // Un repas non donné n'a rien à noter : garder « adoré » serait un
      // contresens, et fausserait les statistiques d'appréciation.
      ...(skipped ? { result: null } : {}),
      logged_at: new Date().toISOString(),
      planned_food_ids: meal.foodIds.length > 0 ? meal.foodIds : null,
    })
    .eq("id", meal.id);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}

/**
 * « Ce repas est fait » — le geste principal du fil du jour.
 *
 * Dire qu'un repas a eu lieu et dire comment il s'est passé sont deux choses :
 * la première est la seule dont le programme a besoin, la seconde est un
 * bonus. `setMealResult` mêlait les deux — il fallait choisir un émoji pour
 * clore un repas, donc juger l'enfant pour renseigner l'app. Ici on confirme
 * sans noter ; l'appréciation se pose ensuite, sur la ligne résumée, ou
 * jamais.
 *
 * Aucune replanification : par définition, rien n'a dévié.
 */
export async function setMealServed(
  babyId: string,
  date: string,
  momentId: string,
  served: boolean,
): Promise<void> {
  const supabase = await createClient();
  const meal = await ensureMeal(supabase, babyId, date, momentId);
  if (!meal) return;

  const { data: current } = await supabase
    .from("meals")
    .select("status")
    .eq("id", meal.id)
    .maybeSingle();

  await supabase
    .from("meals")
    .update({
      // On ne dégrade jamais un signal plus riche : un repas dont la
      // composition a été corrigée reste « remplacé », il a déjà eu lieu.
      status: served
        ? current?.status === "remplace"
          ? "remplace"
          : "servi"
        : "prevu",
      // Revenir en arrière remet le repas en attente, appréciation comprise :
      // une note sur un repas qui n'a plus eu lieu ne veut plus rien dire.
      ...(served ? {} : { result: null }),
      logged_at: served ? new Date().toISOString() : null,
    })
    .eq("id", meal.id);

  revalidateApp();
}

/**
 * « Il a mangé autre chose » — la composition réelle d'un repas.
 *
 * Verrouille le créneau : le parent a raconté ce qui s'est passé, le moteur
 * n'a plus à en décider. Vaut aussi pour un repas à venir que le parent
 * compose lui-même.
 */
export async function logMealFoods(
  babyId: string,
  date: string,
  momentId: string,
  foodIds: string[],
): Promise<ReplanResult> {
  const supabase = await createClient();
  const meal = await ensureMeal(supabase, babyId, date, momentId);
  if (!meal) return { changedDays: 0, sentence: null };

  const planned = [...meal.foodIds].sort();
  const actual = [...foodIds].sort();
  const sameAsPlanned =
    planned.length === actual.length &&
    actual.every((id, i) => id === planned[i]);

  // Doses et provenances des aliments conservés : les réécrire à plat perdrait
  // les doses du protocole allergènes, qui ne se recalculent pas.
  const { data: priorItems } = await supabase
    .from("meal_items")
    .select("food_id, dose, source")
    .eq("meal_id", meal.id);
  const priorById = new Map(
    (
      (priorItems ?? []) as {
        food_id: string;
        dose: string | null;
        source: string;
      }[]
    ).map((it) => [it.food_id, it]),
  );

  await supabase
    .from("meals")
    .update({
      status: sameAsPlanned ? "servi" : "remplace",
      locked: true,
      logged_at: new Date().toISOString(),
      planned_food_ids: meal.foodIds.length > 0 ? meal.foodIds : null,
    })
    .eq("id", meal.id);

  await supabase.from("meal_items").delete().eq("meal_id", meal.id);
  if (foodIds.length > 0) {
    await supabase.from("meal_items").insert(
      foodIds.map((food_id) => {
        const prior = priorById.get(food_id);
        return {
          meal_id: meal.id,
          food_id,
          dose: prior?.dose ?? null,
          source: prior?.source ?? "parent",
          skipped: false,
        };
      }),
    );
  }

  // Les allergènes suivent les aliments réellement servis : c'est la seule
  // source honnête, un lien orphelin ferait croire à une exposition.
  await syncMealAllergens(supabase, meal.id);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}

/**
 * « Tout s'est passé comme prévu » — la confirmation groupée de la bande de
 * rattrapage. Un tap pour plusieurs jours : c'est ce geste qui rend le suivi
 * tenable pour un parent débordé.
 *
 * Ne touche qu'aux repas restés sans signal : une note déjà posée fait foi.
 * Aucune replanification — par définition, rien n'a dévié.
 *
 * ── Depuis que la bande couvre aussi le jour en cours ────────────────────────
 * `toISO` vaut désormais aujourd'hui, et « tout s'est passé comme prévu »
 * validerait alors le dîner de ce soir — un repas que personne n'a encore
 * servi. `openMomentIds` porte les créneaux du dernier jour qui n'ont pas
 * encore fini : ils sont exclus de la mise à jour. C'est la seule chose que ce
 * bouton ne doit jamais faire, affirmer un repas à venir.
 */
export async function confirmMealsAsPlanned(
  babyId: string,
  fromISO: string,
  toISO: string,
  openMomentIds: string[] = [],
): Promise<void> {
  const supabase = await createClient();
  let query = supabase
    .from("meals")
    .update({ status: "servi", logged_at: new Date().toISOString() })
    .eq("baby_id", babyId)
    .eq("status", "prevu")
    .gte("date", fromISO)
    .lte("date", toISO);

  if (openMomentIds.length > 0) {
    // « un jour antérieur au dernier, OU un créneau déjà terminé ». Un repas
    // sans moment du dernier jour tombe du mauvais côté du `not.in` et n'est
    // pas confirmé : ne rien affirmer est la bonne erreur.
    query = query.or(
      `date.lt.${toISO},meal_moment_id.not.in.(${openMomentIds.join(",")})`,
    );
  }

  await query;
  revalidateApp();
}

/**
 * « On ne sera pas là » — l'anticipation, symétrique du rattrapage.
 *
 * Le meilleur signal est celui donné en avance : le plan se décale avant que le
 * problème existe, et la liste de courses avec lui.
 */
export async function setDayAbsent(
  babyId: string,
  date: string,
): Promise<ReplanResult> {
  const supabase = await createClient();
  await supabase
    .from("meals")
    .update({
      status: "saute",
      result: null,
      logged_at: new Date().toISOString(),
    })
    .eq("baby_id", babyId)
    .eq("date", date);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}

/**
 * « Je n'ai pas ça » — l'échange d'un aliment contre un autre, avant le repas.
 *
 * Corrige le jour même, ce que la replanification s'interdit de faire seule :
 * ici c'est le parent qui le demande, sur le repas qu'il a sous les yeux. Le
 * créneau est verrouillé, et la suite du programme se réajuste derrière.
 */
export async function substituteFood(
  babyId: string,
  date: string,
  momentId: string,
  fromFoodId: string,
  toFoodId: string,
): Promise<ReplanResult> {
  const supabase = await createClient();
  const meal = await ensureMeal(supabase, babyId, date, momentId);
  if (!meal) return { changedDays: 0, sentence: null };

  const { data: item } = await supabase
    .from("meal_items")
    .select("id")
    .eq("meal_id", meal.id)
    .eq("food_id", fromFoodId)
    .maybeSingle();
  if (!item) return { changedDays: 0, sentence: null };

  // La dose ne suit pas l'aliment : elle appartenait au protocole du support
  // remplacé. Un légume de substitution n'a pas de palier à respecter.
  await supabase
    .from("meal_items")
    .update({ food_id: toFoodId, dose: null, source: "parent", skipped: false })
    .eq("id", item.id);

  await supabase
    .from("meals")
    .update({
      locked: true,
      logged_at: new Date().toISOString(),
      planned_food_ids: meal.foodIds.length > 0 ? meal.foodIds : null,
    })
    .eq("id", meal.id);

  // Les liens d'allergènes suivent la composition réelle.
  await syncMealAllergens(supabase, meal.id);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}

/**
 * Confirme ou infirme qu'un aliment précis a bien été donné, alors que le reste
 * du repas l'a été. N'existe que pour le protocole allergènes, où la
 * confirmation est une donnée de sécurité — ailleurs, cette finesse ne
 * mériterait pas un geste de plus.
 */
export async function setItemSkipped(
  babyId: string,
  mealItemId: string,
  skipped: boolean,
): Promise<ReplanResult> {
  const supabase = await createClient();
  await supabase.from("meal_items").update({ skipped }).eq("id", mealItemId);

  const replan = await replanFrom(babyId);
  revalidateApp();
  return replan;
}
