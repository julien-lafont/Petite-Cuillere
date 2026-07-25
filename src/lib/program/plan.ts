/**
 * Programme de diversification automatique — LOGIQUE PURE (aucune I/O).
 * Voir docs/auto-diversification-program.md.
 *
 * 100 % piloté par les données : catégorisation via les champs des aliments
 * (`category`, `age_introduction_min`, `is_allergen`, `allergen_type`), jamais par
 * des noms en dur. Ajouter des aliments/allergènes en base les intègre automatiquement.
 *
 * Règles clés :
 * - 1 seul aliment nouveau introduit par « cycle », dans le créneau ouvert le plus récent ;
 * - chaque nouvel aliment est servi 2 jours d'affilée (introduction + 1 répétition) ;
 * - les aliments déjà mangés avant le démarrage sont considérés « déjà introduits » ;
 * - allergènes espacés d'au moins 3 jours ; légumes d'abord.
 */
import { resolveReferenceDate } from "@/lib/age";
import { addDays, toISODate } from "@/lib/dates";

export type PlanFood = {
  id: string;
  category: string | null;
  age_introduction_min: number | null;
  is_allergen: boolean;
  allergen_type: string | null;
  intro_order: number | null; // ordre de découverte conseillé (guide)
};
export type PlanAllergen = { id: string; name: string };
export type PlanMoment = { id: string; label: string };

export type PlannedMeal = {
  date: string;
  momentId: string;
  foodIds: string[];
  allergenIds: string[];
};
export type Introduction = { foodId: string; date: string };
export type Plan = { meals: PlannedMeal[]; introductions: Introduction[] };

export type BuildPlanInput = {
  birth: Date;
  due: Date | null;
  ageRef: Date | null;
  startISO: string;
  /** Nombre total de jours à générer (7 = une semaine, ~183 = 6 mois). */
  days: number;
  moments: PlanMoment[];
  foods: PlanFood[];
  allergens: PlanAllergen[];
  /** Aliments déjà mangés avant le démarrage (ne seront pas re-« découverts »). */
  alreadyIntroduced?: string[];
};

type MomentType = "petit-dej" | "dejeuner" | "gouter" | "diner" | "autre";

const SLOT_RULES: Record<MomentType, { minAge: number; cats: string[] }[]> = {
  "petit-dej": [{ minAge: 12, cats: ["féculent", "laitier"] }],
  dejeuner: [
    { minAge: 4, cats: ["légume"] },
    // 5,5 mois : repas complet à midi (protéine + fruit en dessert)
    { minAge: 5.5, cats: ["légume", "protéine", "fruit"] },
    { minAge: 6, cats: ["légume", "protéine", "féculent", "fruit"] },
  ],
  // Pas de fruit avant 5,5 mois
  gouter: [{ minAge: 5.5, cats: ["fruit"] }],
  diner: [{ minAge: 7, cats: ["légume", "féculent"] }],
  autre: [{ minAge: 6, cats: ["légume", "féculent"] }],
};

const NEW_FOOD_PRIORITY = [
  "légume",
  "fruit",
  "protéine",
  "féculent",
  "laitier",
];
const SAVORY: MomentType[] = ["dejeuner", "diner", "autre"];
const ALLERGEN_GAP_DAYS = 3;
const ALLERGEN_START_DAY = 5;
const DAYS_PER_MONTH = 30.4375;

function classifyMoment(label: string): MomentType {
  const l = label.toLowerCase();
  if (l.includes("petit")) return "petit-dej";
  if (l.includes("déj") || l.includes("dej") || l.includes("midi"))
    return "dejeuner";
  if (l.includes("goût") || l.includes("gout") || l.includes("collation"))
    return "gouter";
  if (l.includes("dîn") || l.includes("din") || l.includes("soir"))
    return "diner";
  return "autre";
}

function slotCats(type: MomentType, age: number): string[] {
  let cats: string[] = [];
  for (const tier of SLOT_RULES[type]) if (age >= tier.minAge) cats = tier.cats;
  return cats;
}

/**
 * Âge projeté (en mois, décimales possibles) à partir duquel le créneau d'un moment
 * s'ouvre pour la diversification solide. En deçà, le moment reste « au lait » et n'est
 * pas encore théoriquement pertinent (cf. docs/auto-diversification-program.md §3).
 */
export function momentOpensAtMonths(label: string): number {
  const tiers = SLOT_RULES[classifyMoment(label)];
  return Math.min(...tiers.map((t) => t.minAge));
}

/**
 * Catégories d'aliments que le programme place dans ce moment à cet âge projeté
 * (vide tant que le créneau reste « au lait »). Exposé pour que l'app puisse
 * *expliquer* le programme sans redéfinir ses seuils de son côté.
 */
export function slotCatsForLabel(label: string, ageMonths: number): string[] {
  return slotCats(classifyMoment(label), ageMonths);
}

function ageInMonths(ref: Date, day: Date): number {
  return (day.getTime() - ref.getTime()) / (86_400_000 * DAYS_PER_MONTH);
}

function catPriority(cat: string | null): number {
  const i = NEW_FOOD_PRIORITY.indexOf(cat ?? "");
  return i < 0 ? 99 : i;
}

export function buildPlan(input: BuildPlanInput): Plan {
  const { birth, due, ageRef, startISO, days, moments, foods, allergens } =
    input;
  const ref = resolveReferenceDate(birth, due, ageRef);
  const start = new Date(startISO);
  const totalDays = Math.round(days);

  const allergenIdByName = new Map(
    allergens.map((a) => [a.name.trim().toLowerCase(), a.id]),
  );
  const foodById = new Map(foods.map((f) => [f.id, f]));

  const typedMoments = moments.map((m) => ({
    ...m,
    type: classifyMoment(m.label),
  }));

  // Aliments déjà mangés avant le démarrage → déjà « connus ».
  const introduced = new Set<string>(input.alreadyIntroduced ?? []);
  const usage = new Map<string, number>();
  for (const id of introduced) usage.set(id, 0);

  let mgId: string | null = null;
  let lastAllergenDay = -Infinity;
  let pendingRepeat: PlanFood | null = null; // aliment à reproposer le lendemain

  const meals: PlannedMeal[] = [];
  const introductions: Introduction[] = [];

  const allergenLinkFor = (f: PlanFood): string | null => {
    if (!f.is_allergen || !f.allergen_type) return null;
    return allergenIdByName.get(f.allergen_type.trim().toLowerCase()) ?? null;
  };

  for (let d = 0; d < totalDays; d++) {
    const day = addDays(start, d);
    const dateISO = toISODate(day);
    const age = ageInMonths(ref, day);

    const openSlots = typedMoments
      .map((m) => ({ moment: m, cats: slotCats(m.type, age) }))
      .filter((s) => s.cats.length > 0);
    if (openSlots.length === 0) continue;

    const neededCats = new Set(openSlots.flatMap((s) => s.cats));

    // --- Aliment mis en avant aujourd'hui : répétition d'hier, sinon nouveau ---
    let highlight: PlanFood | null = null;

    if (pendingRepeat) {
      highlight = pendingRepeat;
      pendingRepeat = null;
    } else {
      const candidates = foods.filter(
        (f) =>
          !introduced.has(f.id) &&
          (f.age_introduction_min ?? 0) <= age &&
          (NEW_FOOD_PRIORITY.includes(f.category ?? "") || f.is_allergen),
      );
      const introOrder = (f: PlanFood) => f.intro_order ?? 999;
      const sortByPriority = (a: PlanFood, b: PlanFood) =>
        catPriority(a.category) - catPriority(b.category) ||
        introOrder(a) - introOrder(b) ||
        a.id.localeCompare(b.id);
      const allergenAllowed =
        d >= ALLERGEN_START_DAY && d - lastAllergenDay >= ALLERGEN_GAP_DAYS;
      const allergenCands = candidates
        .filter((f) => f.is_allergen)
        .sort(sortByPriority);
      const plainCands = candidates
        .filter((f) => !f.is_allergen && neededCats.has(f.category ?? ""))
        .sort(sortByPriority);

      // Priorité au remplissage des créneaux « vides » : une catégorie ouverte
      // aujourd'hui sans aucun aliment déjà introduit est comblée d'abord
      // (ex. à 5,5 mois, on introduit vite un fruit et une protéine plutôt que
      // d'enchaîner encore des légumes).
      const introducedCatCount = (cat: string) => {
        let n = 0;
        for (const id of introduced)
          if ((foodById.get(id)?.category ?? "") === cat) n++;
        return n;
      };
      const gapCands = plainCands.filter(
        (f) => introducedCatCount(f.category ?? "") === 0,
      );
      const newFood =
        allergenAllowed && allergenCands.length > 0
          ? allergenCands[0]
          : (gapCands[0] ?? plainCands[0] ?? null);

      if (newFood) {
        introduced.add(newFood.id);
        usage.set(newFood.id, 0);
        introductions.push({ foodId: newFood.id, date: dateISO });
        if (newFood.is_allergen) lastAllergenDay = d;
        highlight = newFood;
        pendingRepeat = newFood; // à reproposer demain (2× d'affilée)
      }
    }

    // Slot cible de l'aliment mis en avant
    let highlightPlaced = !highlight;
    const targetSlotIndex = !highlight
      ? -1
      : Math.max(
          0,
          openSlots.findIndex((s) =>
            s.cats.includes(highlight!.category ?? ""),
          ),
        );

    const usedToday = new Set<string>();
    const pickIntroduced = (cat: string): string | null => {
      const pool = [...introduced]
        .map((id) => foodById.get(id))
        .filter(
          (f): f is PlanFood =>
            !!f && f.category === cat && !usedToday.has(f.id),
        )
        .sort(
          (a, b) =>
            (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0) ||
            a.id.localeCompare(b.id),
        );
      return pool[0]?.id ?? null;
    };

    openSlots.forEach((slot, slotIdx) => {
      const foodIds: string[] = [];
      const allergenIds: string[] = [];

      const addFood = (id: string) => {
        if (usedToday.has(id)) return;
        foodIds.push(id);
        usedToday.add(id);
        usage.set(id, (usage.get(id) ?? 0) + 1);
        const f = foodById.get(id);
        if (f) {
          const aid = allergenLinkFor(f);
          if (aid) allergenIds.push(aid);
        }
      };

      for (const cat of slot.cats) {
        if (
          highlight &&
          !highlightPlaced &&
          slotIdx === targetSlotIndex &&
          (highlight.category === cat ||
            !slot.cats.includes(highlight.category ?? ""))
        ) {
          addFood(highlight.id);
          highlightPlaced = true;
        } else {
          const chosen = pickIntroduced(cat);
          if (chosen) addFood(chosen);
        }
      }

      // Matière grasse (assistant) sur les repas salés dès 6 mois
      if (SAVORY.includes(slot.moment.type) && age >= 6) {
        if (!mgId) {
          const mg = foods
            .filter(
              (f) =>
                f.category === "matière grasse" &&
                (f.age_introduction_min ?? 0) <= age,
            )
            .sort(
              (a, b) =>
                (a.age_introduction_min ?? 0) - (b.age_introduction_min ?? 0),
            )[0];
          if (mg) {
            mgId = mg.id;
            introduced.add(mg.id);
            introductions.push({ foodId: mg.id, date: dateISO });
          }
        }
        if (mgId && !foodIds.includes(mgId)) foodIds.push(mgId);
      }

      if (highlight && !highlightPlaced && slotIdx === targetSlotIndex) {
        addFood(highlight.id);
        highlightPlaced = true;
      }

      if (foodIds.length > 0) {
        meals.push({
          date: dateISO,
          momentId: slot.moment.id,
          foodIds,
          allergenIds,
        });
      }
    });
  }

  return { meals, introductions };
}
