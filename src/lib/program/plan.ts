/**
 * Programme de diversification automatique — LOGIQUE PURE (aucune I/O).
 * Voir docs/auto-diversification-program.md.
 *
 * 100 % piloté par les données : catégorisation via les champs des aliments
 * (`category`, `age_introduction_min`, `allergen_id`), jamais par des noms en
 * dur. Ajouter des aliments ou des allergènes en base les intègre
 * automatiquement.
 *
 * Deux pistes indépendantes avancent en parallèle :
 *
 *   DÉCOUVERTE — une nouveauté tous les deux jours (introduction + répétition
 *     le lendemain), en alternance entre les créneaux ouverts, dans l'ordre du
 *     guide (`intro_order`). Cf. `schedule.ts` pour les seuils d'ouverture.
 *
 *   ALLERGÈNES — son propre calendrier, ses doses et son entretien. Cf.
 *     `allergens.ts`. Elle n'entame le rythme des découvertes que lorsque son
 *     support est lui-même un vrai aliment (œuf, poisson, laitage, kiwi) ;
 *     une cuillère de purée de sésame dans une compote connue, non.
 */
import { resolveReferenceDate } from "@/lib/age";
import { addDays, toISODate } from "@/lib/dates";
import {
  DAYS_PER_MONTH,
  FAT_FROM_MONTHS,
  SLOT_CATEGORIES,
  classifyMoment,
  slotCats,
  tenureDaysAt,
  type MomentType,
} from "@/lib/program/schedule";
import {
  MAX_MAINTENANCE_PER_DAY,
  START_AFTER_TENURE_DAYS,
  adaptiveGapDays,
  byIntroOrder,
  doseFor,
  isSchedulable,
  maintenanceIntervalDays,
  windowTooTight,
  type AllergenSpec,
  type PlanNotice,
} from "@/lib/program/allergens";
import type { PlanReality } from "@/lib/program/reality";

export type PlanFood = {
  id: string;
  category: string | null;
  age_introduction_min: number | null;
  is_allergen: boolean;
  allergen_type: string | null;
  /** Allergène porté, en clé étrangère (null si l'aliment n'en porte pas). */
  allergen_id: string | null;
  intro_order: number | null; // ordre de découverte conseillé (guide)
};
export type PlanAllergen = AllergenSpec;
export type PlanMoment = { id: string; label: string };

/** Un aliment dans un repas, avec sa dose quand elle est prescrite (allergènes). */
export type PlannedItem = { foodId: string; dose: string | null };

export type PlannedMeal = {
  date: string;
  momentId: string;
  items: PlannedItem[];
  allergenIds: string[];
};
export type Introduction = { foodId: string; date: string };
export type AllergenIntroduction = { allergenId: string; date: string };

export type Plan = {
  meals: PlannedMeal[];
  introductions: Introduction[];
  allergenIntroductions: AllergenIntroduction[];
  /** Ce que le programme n'a pas pu planifier, et pourquoi. À montrer au parent. */
  notices: PlanNotice[];
};

export type BuildPlanInput = {
  birth: Date;
  due: Date | null;
  ageRef: Date | null;
  startISO: string;
  /** Nombre total de jours à générer (7 = une semaine, ~183 = 6 mois). */
  days: number;
  /**
   * Date du premier aliment solide. NULL = la diversification commence avec ce
   * programme. C'est l'horloge de l'ancienneté, distincte de `startISO` qui
   * n'est qu'une date de génération.
   */
  diversificationStartedOn?: string | null;
  /** Dermatite atopique sévère ou allergie à l'œuf connue (protocole LEAP). */
  atopicRisk?: boolean;
  moments: PlanMoment[];
  foods: PlanFood[];
  allergens: PlanAllergen[];
  /** Aliments déjà mangés avant le démarrage (ne seront pas re-« découverts »). */
  alreadyIntroduced?: string[];
  /** Allergènes déjà exposés : ils passent directement en entretien. */
  alreadyExposedAllergens?: string[];
  /** Allergènes ayant provoqué une réaction : exclus, eux et leurs vecteurs. */
  reactedAllergens?: string[];
  /**
   * Ce que la vraie vie impose au plan : découverte à répéter aujourd'hui,
   * montée d'allergène en attente, créneaux fixés par le parent, interruption.
   * Absent = génération à froid (inscription), où le réel n'existe pas encore.
   * Cf. `reality.ts` et docs/feats/suivi-reel-et-rattrapage.md.
   */
  reality?: PlanReality;
};

/** Priorité de comblement quand plusieurs catégories manquent le même jour. */
const NEW_FOOD_PRIORITY: readonly string[] = SLOT_CATEGORIES;

const SAVORY: MomentType[] = ["dejeuner", "diner", "autre"];

function catPriority(cat: string | null): number {
  const i = NEW_FOOD_PRIORITY.indexOf(cat ?? "");
  return i < 0 ? 99 : i;
}

function ageInMonths(ref: Date, day: Date): number {
  return (day.getTime() - ref.getTime()) / (86_400_000 * DAYS_PER_MONTH);
}

/** Un aliment « découvrable » : il occupe une place au menu, pas juste une dose. */
function isDiscoverable(f: PlanFood): boolean {
  return NEW_FOOD_PRIORITY.includes(f.category ?? "");
}

export function buildPlan(input: BuildPlanInput): Plan {
  const { birth, due, ageRef, startISO, days, moments, allergens } = input;
  const ref = resolveReferenceDate(birth, due, ageRef);
  const start = new Date(startISO);
  const totalDays = Math.round(days);
  const tenureFrom = input.diversificationStartedOn ?? startISO;

  const notices: PlanNotice[] = [];
  const reacted = new Set(input.reactedAllergens ?? []);

  // ── Constitution de la file d'allergènes ────────────────────────────────
  // Un allergène écarté ici l'est pour une raison qu'on doit pouvoir dire au
  // parent : le silence serait pire que l'absence.
  const blockedAllergens = new Set<string>();
  const queue: AllergenSpec[] = [];

  for (const a of [...allergens].filter(isSchedulable).sort(byIntroOrder)) {
    const hasVector = input.foods.some((f) => f.allergen_id === a.id);
    if (reacted.has(a.id)) {
      blockedAllergens.add(a.id);
      notices.push({
        kind: "reaction",
        allergenName: a.name,
        message: `${a.name} n'est pas reproposé : une réaction a été signalée. À reprendre avec un professionnel de santé, jamais seul.`,
      });
      continue;
    }
    if (a.requires_medical_advice && input.atopicRisk) {
      blockedAllergens.add(a.id);
      notices.push({
        kind: "medical-advice",
        allergenName: a.name,
        message: `${a.name} n'est pas planifié automatiquement : en cas d'eczéma sévère ou d'allergie à l'œuf, l'introduction se fait après avis médical.`,
      });
      continue;
    }
    if (!hasVector) {
      notices.push({
        kind: "no-vector",
        allergenName: a.name,
        message: `${a.name} n'a aucun aliment support dans le catalogue : ajoutez-en un pour qu'il soit programmé.`,
      });
      continue;
    }
    queue.push(a);
  }

  // Les vecteurs d'un allergène bloqué disparaissent du catalogue utilisable.
  const foods = input.foods.filter(
    (f) => !(f.allergen_id && blockedAllergens.has(f.allergen_id)),
  );
  const foodById = new Map(foods.map((f) => [f.id, f]));
  const allergenById = new Map(queue.map((a) => [a.id, a]));

  /** Vecteurs d'un allergène, du plus « naturel » au moins. */
  const vectorsFor = (allergenId: string): PlanFood[] =>
    foods
      .filter((f) => f.allergen_id === allergenId)
      .sort(
        (a, b) =>
          (a.age_introduction_min ?? 0) - (b.age_introduction_min ?? 0) ||
          (a.intro_order ?? 999) - (b.intro_order ?? 999),
      );

  const typedMoments = moments.map((m) => ({
    ...m,
    type: classifyMoment(m.label),
  }));

  // Aliments déjà mangés avant le démarrage → déjà « connus ».
  const introduced = new Set<string>(input.alreadyIntroduced ?? []);
  const usage = new Map<string, number>();
  for (const id of introduced) usage.set(id, 0);

  // Allergènes déjà exposés → ils sautent l'introduction et entrent en entretien.
  const introducedAllergens = new Set<string>(
    (input.alreadyExposedAllergens ?? []).filter((id) => allergenById.has(id)),
  );
  const lastAllergenServed = new Map<string, number>();
  for (const id of introducedAllergens) lastAllergenServed.set(id, -99);

  // ── Raccord avec le réel ────────────────────────────────────────────────
  // Une replanification reprend deux fils là où la vraie vie les a laissés :
  // la découverte à répéter aujourd'hui, et la dose de montée encore due. Sans
  // eux, un aliment goûté hier hors programme ne serait jamais reproposé, et un
  // protocole allergène interrompu repartirait de zéro.
  const reality = input.reality ?? {};

  const lockedByKey = new Map<string, string[]>();
  for (const slot of reality.locked ?? []) {
    lockedByKey.set(`${slot.date}|${slot.momentId}`, slot.foodIds);
  }

  let mgId: string | null = null;
  let lastAllergenIntroDay = -Infinity;
  // Découverte à reproposer demain (ou aujourd'hui, si le réel l'impose).
  let pendingRepeat: PlanFood | null = reality.repeatToday
    ? (foodById.get(reality.repeatToday) ?? null)
    : null;
  let pendingAllergen: { spec: AllergenSpec; food: PlanFood } | null = null;
  if (reality.pendingAllergen) {
    const spec = allergenById.get(reality.pendingAllergen.allergenId);
    const food = foodById.get(reality.pendingAllergen.foodId);
    if (spec && food) {
      pendingAllergen = { spec, food };
      // Le test a eu lieu : l'allergène n'est plus en file d'attente, il est en
      // cours de protocole.
      introducedAllergens.add(spec.id);
    }
  }
  let slotCursor = 0; // alternance des découvertes entre créneaux ouverts
  let tightWarned = false;

  const meals: PlannedMeal[] = [];
  const introductions: Introduction[] = [];
  const allergenIntroductions: AllergenIntroduction[] = [];

  for (let d = 0; d < totalDays; d++) {
    const day = addDays(start, d);
    const dateISO = toISODate(day);
    const age = ageInMonths(ref, day);
    // L'interruption gèle la rampe d'ancienneté, jamais le plafond d'âge : le
    // fer et la fenêtre allergènes, eux, n'attendent pas le retour de vacances.
    const tenure = Math.max(
      0,
      tenureDaysAt(dateISO, tenureFrom, startISO) -
        (reality.interruptionDays ?? 0),
    );

    const usedToday = new Set<string>();

    const allSlots = typedMoments
      .map((m) => ({ moment: m, cats: slotCats(m.type, age, tenure) }))
      .filter((s) => s.cats.length > 0);

    // Un créneau fixé par le parent n'est pas régénéré — mais ce qu'il contient
    // existe bel et bien : il nourrit la rotation, sans quoi le lendemain
    // reproposerait le même aliment et une découverte faite par le parent
    // serait comptée deux fois.
    const openSlots = allSlots.filter((s) => {
      const locked = lockedByKey.get(`${dateISO}|${s.moment.id}`);
      if (!locked) return true;
      for (const id of locked) {
        introduced.add(id);
        usage.set(id, (usage.get(id) ?? 0) + 1);
        usedToday.add(id);
        if (pendingRepeat?.id === id) pendingRepeat = null; // déjà reproposé
      }
      return false;
    });
    if (openSlots.length === 0) continue;

    // ══ Piste allergènes ═════════════════════════════════════════════════
    // Une dose portée par un aliment, à une phase donnée du protocole.
    type AllergenDose = {
      spec: AllergenSpec;
      food: PlanFood;
      dose: string | null;
    };
    const allergenDoses: AllergenDose[] = [];
    let introducedToday: { spec: AllergenSpec; food: PlanFood } | null = null;

    if (pendingAllergen) {
      // Jour 2 : la dose cible, même support.
      allergenDoses.push({
        spec: pendingAllergen.spec,
        food: pendingAllergen.food,
        dose: doseFor(pendingAllergen.spec, "montée"),
      });
      lastAllergenServed.set(pendingAllergen.spec.id, d);
      pendingAllergen = null;
    } else {
      const pending = queue.filter((a) => !introducedAllergens.has(a.id));
      if (pending.length > 0 && tenure >= START_AFTER_TENURE_DAYS) {
        if (!tightWarned && windowTooTight(pending, age)) {
          tightWarned = true;
          notices.push({
            kind: "window-too-tight",
            allergenName: pending.map((a) => a.name).join(", "),
            message: `Il reste ${pending.length} allergènes à introduire avant le premier anniversaire — trop peu de temps pour les espacer en sécurité. Le programme place d'abord les plus importants ; parlez du reste à votre médecin.`,
          });
        }
        const gap = adaptiveGapDays(pending, age);
        if (d - lastAllergenIntroDay >= gap) {
          const next = pending.find((a) => {
            if (age < (a.window_start_months ?? 0)) return false;
            return vectorsFor(a.id).some(
              (f) => (f.age_introduction_min ?? 0) <= age,
            );
          });
          if (next) {
            const food = vectorsFor(next.id).find(
              (f) => (f.age_introduction_min ?? 0) <= age,
            )!;
            allergenDoses.push({
              spec: next,
              food,
              dose: doseFor(next, "test"),
            });
            introducedAllergens.add(next.id);
            allergenIntroductions.push({ allergenId: next.id, date: dateISO });
            lastAllergenIntroDay = d;
            lastAllergenServed.set(next.id, d);
            pendingAllergen = { spec: next, food };
            introducedToday = { spec: next, food };
          }
        }
      }
    }

    // Entretien : ~2 g de protéine par semaine, en 2 prises. Un allergène
    // introduit puis abandonné ne protège pas — c'est le point que le
    // programme ratait entièrement.
    const alreadyDosed = new Set(allergenDoses.map((x) => x.spec.id));
    const overdue = [...introducedAllergens]
      .map((id) => allergenById.get(id))
      .filter((a): a is AllergenSpec => !!a && !alreadyDosed.has(a.id))
      .map((a) => ({ a, interval: maintenanceIntervalDays(a) }))
      .filter(
        (x): x is { a: AllergenSpec; interval: number } =>
          x.interval !== null &&
          d - (lastAllergenServed.get(x.a.id) ?? -99) >= x.interval,
      )
      .sort(
        (x, y) =>
          (lastAllergenServed.get(x.a.id) ?? -99) -
          (lastAllergenServed.get(y.a.id) ?? -99),
      )
      .slice(0, MAX_MAINTENANCE_PER_DAY);

    // Une seule dose par catégorie et par jour : sans cela l'entretien empile
    // deux protéines dans le même repas, quand le guide n'en prévoit que 10 g.
    const dosedCategories = new Set(
      allergenDoses.map((x) => x.food.category ?? ""),
    );
    for (const { a } of overdue) {
      const food = vectorsFor(a.id).find(
        (f) => (f.age_introduction_min ?? 0) <= age,
      );
      if (!food) continue;
      const cat = food.category ?? "";
      if (cat !== "autre" && dosedCategories.has(cat)) continue;
      dosedCategories.add(cat);
      allergenDoses.push({ spec: a, food, dose: doseFor(a, "entretien") });
      lastAllergenServed.set(a.id, d);
    }

    // ══ Piste découverte ═════════════════════════════════════════════════
    let highlight: PlanFood | null = null;

    // Un vecteur qui est un vrai aliment ET dont la catégorie est ouverte
    // aujourd'hui (l'œuf quand les protéines sont au menu, le laitage quand le
    // goûter l'est) occupe une place au repas : il vaut découverte du jour, et
    // on n'en ajoute pas une seconde. Sinon — purée d'oléagineux, moutarde,
    // farine, ou œuf avant l'ouverture des protéines — ce n'est qu'une dose
    // posée sur le repas, qui ne consomme rien et ne remplace rien.
    const openCats = new Set(openSlots.flatMap((s) => s.cats));
    const vehicleCountsAsDiscovery =
      !!introducedToday &&
      isDiscoverable(introducedToday.food) &&
      openCats.has(introducedToday.food.category ?? "");

    if (vehicleCountsAsDiscovery) {
      // Placé par la piste allergènes (avec sa dose) : pas de `highlight`, qui
      // le ferait poser deux fois.
      const food = introducedToday!.food;
      introduced.add(food.id);
      usage.set(food.id, 0);
    } else if (pendingRepeat) {
      highlight = pendingRepeat;
      pendingRepeat = null;
    } else {
      const eligible = foods.filter(
        (f) =>
          !introduced.has(f.id) &&
          (f.age_introduction_min ?? 0) <= age &&
          isDiscoverable(f),
      );
      const introOrder = (f: PlanFood) => f.intro_order ?? 999;
      const sortByPriority = (a: PlanFood, b: PlanFood) =>
        catPriority(a.category) - catPriority(b.category) ||
        introOrder(a) - introOrder(b) ||
        a.id.localeCompare(b.id);

      const introducedCatCount = (cat: string) => {
        let n = 0;
        for (const id of introduced)
          if ((foodById.get(id)?.category ?? "") === cat) n++;
        return n;
      };

      // 1. Une catégorie vient de s'ouvrir et n'a encore aucun aliment : sans
      //    ça le créneau resterait vide. Elle passe avant tout le reste.
      const neededCats = new Set(openSlots.flatMap((s) => s.cats));
      const gapCands = eligible
        .filter(
          (f) =>
            neededCats.has(f.category ?? "") &&
            introducedCatCount(f.category ?? "") === 0,
        )
        .sort(sortByPriority);

      if (gapCands.length > 0) {
        highlight = gapCands[0];
      } else {
        // 2. Sinon on tourne entre les créneaux ouverts : le goûter avance sur
        //    les fruits pendant que le midi avance sur les légumes, au lieu de
        //    vider une catégorie avant de passer à la suivante.
        for (let k = 0; k < openSlots.length && !highlight; k++) {
          const slot = openSlots[(slotCursor + k) % openSlots.length];
          const cands = eligible
            .filter((f) => slot.cats.includes(f.category ?? ""))
            .sort(sortByPriority);
          if (cands.length > 0) {
            highlight = cands[0];
            slotCursor = (slotCursor + k + 1) % openSlots.length;
          }
        }
      }

      if (highlight) {
        introduced.add(highlight.id);
        usage.set(highlight.id, 0);
        introductions.push({ foodId: highlight.id, date: dateISO });
        pendingRepeat = highlight; // reproposé demain (2 jours d'affilée)
      }
    }

    // ══ Composition des repas ════════════════════════════════════════════
    let highlightPlaced = !highlight;
    const targetSlotIndex = !highlight
      ? -1
      : Math.max(
          0,
          openSlots.findIndex((s) =>
            s.cats.includes(highlight!.category ?? ""),
          ),
        );

    // Où poser une dose d'allergène qui n'est pas un aliment de repas : le
    // goûter, où compote et laitage servent de support (« délayé dans une
    // compote ou un yaourt »), sauf pour un condiment qui va au salé.
    // Un créneau ne peut porter un additif que s'il a de quoi le délayer : un
    // goûter réduit à une cuillère de farine n'est pas un goûter.
    const slotHasSupport = (slot: (typeof openSlots)[number]): boolean =>
      slot.cats.some((cat) =>
        [...introduced].some((id) => foodById.get(id)?.category === cat),
      );

    const doseSlotIndex = (spec: AllergenSpec, food: PlanFood): number => {
      const byCategory = openSlots.findIndex((s) =>
        s.cats.includes(food.category ?? ""),
      );
      if (byCategory >= 0) return byCategory;
      if (spec.type === "condiment") {
        const savory = openSlots.findIndex(
          (s) => SAVORY.includes(s.moment.type) && slotHasSupport(s),
        );
        if (savory >= 0) return savory;
      }
      const gouter = openSlots.findIndex(
        (s) => s.moment.type === "gouter" && slotHasSupport(s),
      );
      if (gouter >= 0) return gouter;
      const anySupported = openSlots.findIndex(slotHasSupport);
      return anySupported >= 0 ? anySupported : 0;
    };

    const dosePlacement = new Map<number, AllergenDose[]>();
    for (const dose of allergenDoses) {
      const idx = doseSlotIndex(dose.spec, dose.food);
      const list = dosePlacement.get(idx) ?? [];
      list.push(dose);
      dosePlacement.set(idx, list);
    }

    const byLeastUsed = (a: PlanFood, b: PlanFood) =>
      (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0) ||
      a.id.localeCompare(b.id);

    /**
     * Un aliment déjà connu pour cette catégorie, le moins servi d'abord.
     *
     * Repli volontaire sur un aliment déjà au menu du jour : au tout début, une
     * seule pomme est connue, et le dessert du midi viderait sinon le goûter,
     * qui disparaîtrait purement et simplement du programme. Mieux vaut la même
     * compote deux fois qu'un créneau annulé.
     */
    const pickIntroduced = (cat: string): string | null => {
      const known = [...introduced]
        .map((id) => foodById.get(id))
        .filter((f): f is PlanFood => !!f && f.category === cat);
      const fresh = known.filter((f) => !usedToday.has(f.id));
      return (
        (fresh.length > 0 ? fresh : known).sort(byLeastUsed)[0]?.id ?? null
      );
    };

    openSlots.forEach((slot, slotIdx) => {
      const items: PlannedItem[] = [];
      const allergenIds = new Set<string>();

      const addFood = (id: string, dose: string | null = null) => {
        if (items.some((it) => it.foodId === id)) return; // pas deux fois ici
        items.push({ foodId: id, dose });
        usedToday.add(id);
        usage.set(id, (usage.get(id) ?? 0) + 1);
        const aid = foodById.get(id)?.allergen_id;
        if (aid) allergenIds.add(aid);
      };

      const slotDoses = dosePlacement.get(slotIdx) ?? [];

      // Une dose portée par un vrai aliment *tient* la place de sa catégorie :
      // l'œuf du protocole est la protéine du jour, il ne s'ajoute pas à une
      // seconde. Le guide n'accorde que 10 g de protéine par jour, et deux
      // portions dans le même repas les dépasseraient.
      const catTakenByDose = new Set<string>();
      for (const dose of slotDoses) {
        const cat = dose.food.category ?? "";
        if (!slot.cats.includes(cat)) continue;
        // La découverte du jour garde la priorité sur sa propre catégorie.
        if (
          highlight &&
          !highlightPlaced &&
          slotIdx === targetSlotIndex &&
          highlight.category === cat
        ) {
          continue;
        }
        catTakenByDose.add(cat);
      }

      for (const cat of slot.cats) {
        if (catTakenByDose.has(cat)) continue;
        if (
          highlight &&
          !highlightPlaced &&
          slotIdx === targetSlotIndex &&
          highlight.category === cat
        ) {
          addFood(highlight.id);
          highlightPlaced = true;
        } else {
          const chosen = pickIntroduced(cat);
          if (chosen) addFood(chosen);
        }
      }

      // Matière grasse sur les repas salés dès 6 mois.
      if (SAVORY.includes(slot.moment.type) && age >= FAT_FROM_MONTHS) {
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
        if (mgId && !usedToday.has(mgId)) addFood(mgId);
      }

      if (highlight && !highlightPlaced && slotIdx === targetSlotIndex) {
        addFood(highlight.id);
        highlightPlaced = true;
      }

      // Doses d'allergènes affectées à ce créneau.
      for (const dose of slotDoses) {
        // Déjà au menu de ce repas (l'œuf du midi, par exemple) : on ne double
        // pas la portion, on marque seulement la dose prescrite.
        const existing = items.find((it) => it.foodId === dose.food.id);
        if (existing) {
          if (!existing.dose) existing.dose = dose.dose;
          allergenIds.add(dose.spec.id);
          continue;
        }
        addFood(dose.food.id, dose.dose);
        if (!introduced.has(dose.food.id)) {
          introduced.add(dose.food.id);
          usage.set(dose.food.id, 0);
          introductions.push({ foodId: dose.food.id, date: dateISO });
        }
      }

      if (items.length > 0) {
        meals.push({
          date: dateISO,
          momentId: slot.moment.id,
          items,
          allergenIds: [...allergenIds],
        });
      }
    });
  }

  return { meals, introductions, allergenIntroductions, notices };
}
