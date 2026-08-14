/**
 * Automatic diversification programme — PURE LOGIC (no I/O).
 * See docs/auto-diversification-program.md.
 *
 * 100 % data-driven: categorisation comes from the foods' own fields
 * (`category`, `age_introduction_min`, `allergen_id`), never from hard-coded
 * names. Adding foods or allergens to the database brings them in
 * automatically.
 *
 * Two independent tracks run in parallel:
 *
 *   DISCOVERY — one new food every two days (introduction plus a repeat the
 *     next day), alternating between the open slots, in the guide's order
 *     (`intro_order`). See `schedule.ts` for the opening thresholds.
 *
 *   ALLERGENS — its own calendar, doses and maintenance. See `allergens.ts`. It
 *     only eats into the discovery rhythm when its carrier is itself a real food
 *     (egg, fish, dairy, kiwi); a spoon of sesame paste in a familiar compote
 *     does not.
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
import { slotGroupOf } from "@/lib/categories";
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
  /**
   * A dose laid on the meal, not a food of the meal: mustard, sesame paste,
   * flour stirred into a bottle. It is not discovered and takes no slot — the
   * food has carried this since 0023, its category no longer being enough to say
   * it.
   */
  dose_only?: boolean | null;
  age_introduction_min: number | null;
  is_allergen: boolean;
  allergen_type: string | null;
  /** Allergen carried, as a foreign key (null when the food carries none). */
  allergen_id: string | null;
  intro_order: number | null; // recommended discovery order (guide)
};
export type PlanAllergen = AllergenSpec;
export type PlanMoment = { id: string; label: string };

/** A food in a meal, with its dose when one is prescribed (allergens). */
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
  /** What the programme could not plan, and why. To show to the parent. */
  notices: PlanNotice[];
};

export type BuildPlanInput = {
  birth: Date;
  due: Date | null;
  ageRef: Date | null;
  startISO: string;
  /** Total days to generate (7 = a week, ~183 = 6 months). */
  days: number;
  /**
   * Date of the first solid food. NULL = diversification starts with this
   * programme. It is the elapsed-time clock, distinct from `startISO`, which is
   * only a generation date.
   */
  diversificationStartedOn?: string | null;
  /** Severe atopic dermatitis or known egg allergy (LEAP protocol). */
  atopicRisk?: boolean;
  moments: PlanMoment[];
  foods: PlanFood[];
  allergens: PlanAllergen[];
  /** Foods already eaten before the start (they will not be re-"discovered"). */
  alreadyIntroduced?: string[];
  /** Allergens already met: they go straight to maintenance. */
  alreadyExposedAllergens?: string[];
  /** Allergens that caused a reaction: excluded, along with their carriers. */
  reactedAllergens?: string[];
  /**
   * What real life imposes on the plan: a discovery to repeat today, a pending
   * allergen ramp-up, slots fixed by the parent, an interruption. Absent = cold
   * generation (sign-up), where reality does not exist yet. See `reality.ts` and
   * docs/feats/suivi-reel-et-rattrapage.md.
   */
  reality?: PlanReality;
};

/** Fill priority when several categories are missing on the same day. */
const NEW_FOOD_PRIORITY: readonly string[] = SLOT_CATEGORIES;

const SAVORY: MomentType[] = ["dejeuner", "diner", "autre"];

function catPriority(cat: string | null): number {
  const i = NEW_FOOD_PRIORITY.indexOf(slotGroupOf(cat) ?? "");
  return i < 0 ? 99 : i;
}

/**
 * The slot a food takes — its group, not its display category. Rice, lentils and
 * potato all count as "féculent" here: the generator only puts one per meal (see
 * `slotGroupOf`, src/lib/categories.ts). NULL for a dose, which never takes a
 * place.
 */
function slotOf(f: PlanFood): string | null {
  return f.dose_only ? null : slotGroupOf(f.category);
}

function ageInMonths(ref: Date, day: Date): number {
  return (day.getTime() - ref.getTime()) / (86_400_000 * DAYS_PER_MONTH);
}

/** A "discoverable" food: it takes a place on the menu, not just a dose. */
function isDiscoverable(f: PlanFood): boolean {
  return NEW_FOOD_PRIORITY.includes(slotOf(f) ?? "");
}

export function buildPlan(input: BuildPlanInput): Plan {
  const { birth, due, ageRef, startISO, days, moments, allergens } = input;
  const ref = resolveReferenceDate(birth, due, ageRef);
  const start = new Date(startISO);
  const totalDays = Math.round(days);
  const tenureFrom = input.diversificationStartedOn ?? startISO;

  const notices: PlanNotice[] = [];
  const reacted = new Set(input.reactedAllergens ?? []);

  // ── Building the allergen queue ─────────────────────────────────────────
  // An allergen set aside here is set aside for a reason we must be able to give
  // the parent: silence would be worse than the absence.
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

  // The carriers of a blocked allergen leave the usable catalogue.
  const foods = input.foods.filter(
    (f) => !(f.allergen_id && blockedAllergens.has(f.allergen_id)),
  );
  const foodById = new Map(foods.map((f) => [f.id, f]));
  const allergenById = new Map(queue.map((a) => [a.id, a]));

  /** Carriers of an allergen, most "natural" first. */
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

  // Foods already eaten before the start → already "known".
  const introduced = new Set<string>(input.alreadyIntroduced ?? []);
  const usage = new Map<string, number>();
  for (const id of introduced) usage.set(id, 0);

  // Allergens already met → they skip introduction and go into maintenance.
  const introducedAllergens = new Set<string>(
    (input.alreadyExposedAllergens ?? []).filter((id) => allergenById.has(id)),
  );
  const lastAllergenServed = new Map<string, number>();
  for (const id of introducedAllergens) lastAllergenServed.set(id, -99);

  // ── Picking up from reality ─────────────────────────────────────────────
  // A replan picks two threads back up where real life left them: the discovery
  // to repeat today, and the ramp-up dose still owed. Without them, a food
  // tasted yesterday outside the programme would never be offered again, and an
  // interrupted allergen protocol would restart from scratch.
  const reality = input.reality ?? {};

  const lockedByKey = new Map<string, string[]>();
  for (const slot of reality.locked ?? []) {
    lockedByKey.set(`${slot.date}|${slot.momentId}`, slot.foodIds);
  }

  let mgId: string | null = null;
  let lastAllergenIntroDay = -Infinity;
  // Discovery to offer again tomorrow (or today, when reality demands it).
  let pendingRepeat: PlanFood | null = reality.repeatToday
    ? (foodById.get(reality.repeatToday) ?? null)
    : null;
  let pendingAllergen: { spec: AllergenSpec; food: PlanFood } | null = null;
  if (reality.pendingAllergen) {
    const spec = allergenById.get(reality.pendingAllergen.allergenId);
    const food = foodById.get(reality.pendingAllergen.foodId);
    if (spec && food) {
      pendingAllergen = { spec, food };
      // The test happened: the allergen is no longer queued, it is mid-protocol.
      introducedAllergens.add(spec.id);
    }
  }
  let slotCursor = 0; // rotate discoveries between the open slots
  let tightWarned = false;

  const meals: PlannedMeal[] = [];
  const introductions: Introduction[] = [];
  const allergenIntroductions: AllergenIntroduction[] = [];

  for (let d = 0; d < totalDays; d++) {
    const day = addDays(start, d);
    const dateISO = toISODate(day);
    const age = ageInMonths(ref, day);
    // An interruption freezes the elapsed-time ramp, never the age ceiling:
    // iron and the allergen window do not wait for the holiday to end.
    const tenure = Math.max(
      0,
      tenureDaysAt(dateISO, tenureFrom, startISO) -
        (reality.interruptionDays ?? 0),
    );

    const usedToday = new Set<string>();

    const allSlots = typedMoments
      .map((m) => ({ moment: m, cats: slotCats(m.type, age, tenure) }))
      .filter((s) => s.cats.length > 0);

    // A slot the parent fixed is not regenerated — but what it holds is real
    // all the same: it feeds the rotation, otherwise the next day would offer
    // the same food again and a discovery made by the parent would be counted
    // twice.
    const openSlots = allSlots.filter((s) => {
      const locked = lockedByKey.get(`${dateISO}|${s.moment.id}`);
      if (!locked) return true;
      for (const id of locked) {
        introduced.add(id);
        usage.set(id, (usage.get(id) ?? 0) + 1);
        usedToday.add(id);
        if (pendingRepeat?.id === id) pendingRepeat = null; // already re-offered
      }
      return false;
    });
    if (openSlots.length === 0) continue;

    // ══ Allergen track ═══════════════════════════════════════════════════
    // A dose carried by a food, at a given phase of the protocol.
    type AllergenDose = {
      spec: AllergenSpec;
      food: PlanFood;
      dose: string | null;
    };
    const allergenDoses: AllergenDose[] = [];
    let introducedToday: { spec: AllergenSpec; food: PlanFood } | null = null;

    if (pendingAllergen) {
      // Day 2: the target dose, same carrier.
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

    // Maintenance: ~2 g of protein a week, over 2 servings. An allergen
    // introduced then dropped does not protect — the point the programme missed
    // entirely.
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

    // One slot taken per day: without this, maintenance stacks two proteins in
    // the same meal, where the guide allows only 10 g. Doses take no slot at all
    // — a dab of mustard and a spoon of sesame paste can land on the same day.
    const dosedSlots = new Set(
      allergenDoses.map((x) => slotOf(x.food)).filter((s) => s !== null),
    );
    for (const { a } of overdue) {
      const food = vectorsFor(a.id).find(
        (f) => (f.age_introduction_min ?? 0) <= age,
      );
      if (!food) continue;
      const slot = slotOf(food);
      if (slot !== null) {
        if (dosedSlots.has(slot)) continue;
        dosedSlots.add(slot);
      }
      allergenDoses.push({ spec: a, food, dose: doseFor(a, "entretien") });
      lastAllergenServed.set(a.id, d);
    }

    // ══ Discovery track ══════════════════════════════════════════════════
    let highlight: PlanFood | null = null;

    // A carrier that is a real food AND whose category is open today (egg when
    // proteins are on the menu, dairy when the snack is) takes a place in the
    // meal: it counts as the day's discovery, and we do not add a second.
    // Otherwise — nut butter, mustard, flour, or egg before proteins open — it
    // is only a dose laid on the meal, consuming nothing and replacing nothing.
    const openCats = new Set(openSlots.flatMap((s) => s.cats));
    const vehicleCountsAsDiscovery =
      !!introducedToday &&
      isDiscoverable(introducedToday.food) &&
      openCats.has(slotOf(introducedToday.food) ?? "");

    if (vehicleCountsAsDiscovery) {
      // Placed by the allergen track (with its dose): no `highlight`, which
      // would put it down twice.
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
        for (const id of introduced) {
          const f = foodById.get(id);
          if (f && slotOf(f) === cat) n++;
        }
        return n;
      };

      // 1. A category has just opened and still has no food: without this the
      //    slot would stay empty. It comes before everything else. A rice
      //    already known fills the starch slot: the group is what counts, not
      //    the shop aisle (`slotOf`).
      const neededCats = new Set(openSlots.flatMap((s) => s.cats));
      const gapCands = eligible
        .filter(
          (f) =>
            neededCats.has(slotOf(f) ?? "") &&
            introducedCatCount(slotOf(f) ?? "") === 0,
        )
        .sort(sortByPriority);

      if (gapCands.length > 0) {
        highlight = gapCands[0];
      } else {
        // 2. Otherwise rotate between the open slots: the snack moves ahead on
        //    fruit while midday moves ahead on vegetables, instead of emptying
        //    one category before starting the next.
        for (let k = 0; k < openSlots.length && !highlight; k++) {
          const slot = openSlots[(slotCursor + k) % openSlots.length];
          const cands = eligible
            .filter((f) => slot.cats.includes(slotOf(f) ?? ""))
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
        pendingRepeat = highlight; // offered again tomorrow (2 days running)
      }
    }

    // ══ Meal composition ═════════════════════════════════════════════════
    let highlightPlaced = !highlight;
    const targetSlotIndex = !highlight
      ? -1
      : Math.max(
          0,
          openSlots.findIndex((s) => s.cats.includes(slotOf(highlight!) ?? "")),
        );

    // Where to put an allergen dose that is not a meal food: the snack, where
    // compote and dairy act as carriers ("stirred into a compote or a yoghurt"),
    // except for a condiment, which goes to the savoury course.
    // A slot can only carry an addition when it has something to stir it into: a
    // snack cut down to a spoon of flour is not a snack.
    const slotHasSupport = (slot: (typeof openSlots)[number]): boolean =>
      slot.cats.some((cat) =>
        [...introduced].some((id) => {
          const f = foodById.get(id);
          return !!f && slotOf(f) === cat;
        }),
      );

    const doseSlotIndex = (spec: AllergenSpec, food: PlanFood): number => {
      // `slotOf` is NULL for a dose: it therefore never lands "by category",
      // even now that tofu is a pulse and flour a grain — two slots that do very
      // much exist.
      const byCategory = openSlots.findIndex((s) =>
        s.cats.includes(slotOf(food) ?? ""),
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
     * A food already known for this category, least served first.
     *
     * Deliberately falls back on a food already on the day's menu: at the very
     * start only one apple is known, and midday dessert would otherwise empty
     * the snack, which would disappear from the programme entirely. The same
     * compote twice beats a cancelled slot.
     */
    const pickIntroduced = (cat: string): string | null => {
      const known = [...introduced]
        .map((id) => foodById.get(id))
        .filter((f): f is PlanFood => !!f && slotOf(f) === cat);
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

      // A dose carried by a real food *takes* its category's place: the
      // protocol's egg is the day's protein, it does not add a second one. The
      // guide allows only 10 g of protein a day, and two portions in the same
      // meal would exceed it.
      const catTakenByDose = new Set<string>();
      for (const dose of slotDoses) {
        const cat = slotOf(dose.food);
        if (cat === null || !slot.cats.includes(cat)) continue;
        // The day's discovery keeps priority over its own category.
        if (
          highlight &&
          !highlightPlaced &&
          slotIdx === targetSlotIndex &&
          slotOf(highlight) === cat
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
          slotOf(highlight) === cat
        ) {
          addFood(highlight.id);
          highlightPlaced = true;
        } else {
          const chosen = pickIntroduced(cat);
          if (chosen) addFood(chosen);
        }
      }

      // Fat on savoury meals from 6 months.
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

      // Allergen doses assigned to this slot.
      for (const dose of slotDoses) {
        // Already on this meal's menu (the midday egg, say): we do not double
        // the portion, only mark the prescribed dose.
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
