/**
 * Builds a step-by-step from a meal's foods and the baby's age. Aim: simple and
 * effective, with a Babycook-style steamer-blender — no gastronomy (see
 * docs/ux-redesign.md §5).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * A MEAL IS NOT A PLATE
 *
 * That was the first version's mistake: it took every food in the meal, threw
 * them into a single steam cook timed on the longest one, and blended it all
 * once. But the generator does put a fruit **and** a vegetable in the same lunch
 * from 5.5 months (`schedule.ts`): the fruit is dessert there, not an ingredient
 * of the purée. So we got "steam squash, hard-boiled egg and peach together".
 *
 * A meal breaks down into separate **preparations**, never mixed:
 *
 *   SAVOURY — vegetable, protein, starch, fat. Eaten first.
 *   SWEET   — fruit. A compote, as dessert.
 *
 * And inside one preparation, not everything cooks the same way:
 *
 *   steam — vegetables, fruit to cook, meat and fish. One shared cook, timed on
 *           the longest.
 *   water — hard-boiled egg, rice, pasta, semolina, pulses. They cook **apart**,
 *           in their own water; steaming them afterwards would be absurd (the
 *           hard-boiled egg is already hard).
 *   none  — avocado, banana, ham. Folded in after cooking.
 *
 * Some foods finally blend with nothing: dairy is served plain alongside, a
 * crust of bread is chewed. That is `served_apart` in the database.
 *
 * These three facts — cook method, host preparation, served apart — cannot be
 * guessed from the category: they live in the catalogue like everything else
 * (`cook_method`, `course`, `served_apart` — see migration 0019).
 */

import { slotGroupOf } from "@/lib/categories";
import { portionFor, type Portion } from "@/lib/portions";
import { textureFor } from "@/lib/program/schedule";
import type { Season } from "@/lib/season";
import type { MealItem } from "@/lib/data/meals.types";

export type RecipeStep = {
  /**
   * The food this step is about, when it targets just one ("œuf dur", "pomme").
   * It opens the step in bold: the eye finds the ingredient in the list without
   * re-reading the sentence. Absent on shared steps ("cuis à la vapeur 15 min"),
   * which belong to nobody.
   */
  lead?: string;
  text: string;
  /** Minutes, when the step is a cook — for a possible timer. */
  minutes?: number;
};

/** A meal's two preparations. They never mix. */
export type RecipeCourse = "salé" | "sucré";

export type MealFoodLine = {
  id: string;
  name: string;
  category: string | null;
  isAllergen: boolean;
  portion: Portion;
  /**
   * True when the displayed quantity is a dose prescribed by the allergen
   * protocol rather than a portion derived from age. The difference matters to
   * the parent: a knife-tip of peanut butter is a step to respect, not a
   * guideline to adjust to appetite.
   */
  isPrescribedDose: boolean;
  /** The preparation this food lands in — null when it is served on its own. */
  course: RecipeCourse | null;
  /**
   * Season and restriction travel with the line: both are read **on the food**
   * ("courge · de saison", "miel — pas avant 12 mois"), not in a block of advice
   * at the bottom of the card where the parent had to make the connection
   * themselves.
   */
  season: Season;
  restrictions: string | null;
};

export type RecipePart = {
  course: RecipeCourse;
  /**
   * The preparation's name, written to sit mid-sentence ("dans la compote") as
   * well as in a title. It follows the texture: at the age of lumps, it is no
   * longer a purée.
   */
  name: string;
  steps: RecipeStep[];
};

export type ComposedRecipe = {
  lines: MealFoodLine[];
  parts: RecipePart[];
  /** What belongs to no preparation: plain dairy, a crust of bread… */
  extraSteps: RecipeStep[];
};

/**
 * Target texture. Age rules — the lumps window (8-10 months per ESPGHAN) does
 * not shift because diversification started late. How long they have been at it
 * can only hold back the smooth texture, and only for the first few days: the
 * threshold lives in `program/schedule.ts`.
 */
export function textureForAge(months: number, tenureDays = Infinity): string {
  return textureFor(months, tenureDays);
}

type RecipeFood = NonNullable<MealItem["food"]>;

type CookMethod = "vapeur" | "eau" | "aucune";

const COOK_METHODS: readonly string[] = ["vapeur", "eau", "aucune"];

/** The `textureFor` textures (`schedule.ts`) that are no longer "blended". */
const MORSELS = "petits morceaux fondants";
const MASHED = "écrasé à la fourchette";

/** Categories that make up the savoury course, when `course` is not set. */
const SAVORY_CATEGORIES: readonly string[] = [
  "légume", // avocado sits here on purpose: it is served mashed into a savoury purée
  "protéine",
  "féculent",
  "céréale",
  "légumineuse",
  "matière grasse",
];

/**
 * How this food cooks. The fallbacks only serve a database not yet migrated:
 * without `cook_method` we cannot tell boiling from steaming, and the
 * hard-boiled egg goes back into the steamer.
 */
function cookMethodOf(f: RecipeFood): CookMethod {
  const m = f.cook_method;
  if (m && COOK_METHODS.includes(m)) return m as CookMethod;
  return (f.cook_minutes ?? 0) > 0 ? "vapeur" : "aucune";
}

/** Which preparation this food lands in. Null = it is served on its own. */
function courseOf(f: RecipeFood): RecipeCourse | null {
  if (f.course === "salé" || f.course === "sucré") return f.course;
  if (f.category === "fruit") return "sucré";
  if (SAVORY_CATEGORIES.includes(f.category ?? "")) return "salé";
  return null;
}

/** Served as is, never blended with the rest. */
function isServedApart(f: RecipeFood): boolean {
  if (typeof f.served_apart === "boolean") return f.served_apart;
  return f.category === "laitier";
}

/**
 * A dose added on top of a meal rather than a food of the meal: nut butter,
 * mustard, tofu, a pinch of herbs. It is stirred into an existing preparation —
 * which is how `plan.ts` already places them.
 *
 * A property of the food, not of its category (migration 0023): tofu really is a
 * pulse and flour really is a grain, but neither makes a dish. The fallback on
 * "autre" covers a database not yet migrated, where the category still carried
 * this on its own.
 */
function isAddon(f: RecipeFood): boolean {
  if (typeof f.dose_only === "boolean") return f.dose_only;
  return f.category === "autre";
}

function isFat(f: RecipeFood): boolean {
  return f.category === "matière grasse";
}

/** Savoury first, sweet next, whatever is served on its own last. */
function lineRank(course: RecipeCourse | null): number {
  return course === "salé" ? 0 : course === "sucré" ? 1 : 2;
}

/**
 * Builds a meal's recipe. `months` drives the quantities and the texture.
 */
export function composeRecipe(
  items: MealItem[],
  months: number,
): ComposedRecipe {
  const withFood = items.filter(
    (it): it is MealItem & { food: RecipeFood } => it.food !== null,
  );
  const foods = withFood.map((it) => it.food);

  // Lines follow the order of the preparations, never the plan's: reading
  // "courge · pêche · œuf dur" would suggest it all goes to the same place.
  const lines: MealFoodLine[] = withFood
    .map(({ food: f, dose }) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      isAllergen: f.is_allergen,
      // The protocol dose wins over the computed portion: it is what was planned,
      // and showing it as "~150 g" would be wrong and dangerous. Then comes the
      // food's own portion, when it has one.
      portion: dose
        ? { label: dose, grams: null }
        : portionFor(f.category, months, f),
      isPrescribedDose: !!dose,
      course: isServedApart(f) ? null : courseOf(f),
      season: f.season,
      restrictions: f.restrictions,
    }))
    .sort((a, b) => lineRank(a.course) - lineRank(b.course));

  const texture = textureForAge(months);

  // ── Distribution ────────────────────────────────────────────────────────
  // Exclusive, and in this order: a food served apart goes nowhere, a dose
  // does not make a preparation, a fat is not an ingredient you cook.
  const apart: RecipeFood[] = [];
  const addons: RecipeFood[] = [];
  const fats: RecipeFood[] = [];
  const members: RecipeFood[] = [];

  for (const f of foods) {
    if (isServedApart(f)) apart.push(f);
    else if (isAddon(f)) addons.push(f);
    else if (isFat(f)) fats.push(f);
    else members.push(f);
  }

  // Fats are always raw and always in the savoury course: a spoon of rapeseed
  // oil in a compote makes no sense. With no savoury course — which the
  // generator never produces, but a parent can compose by hand — they follow
  // whichever preparation comes first.
  const fatCourse: RecipeCourse = members.some(
    (f) => (courseOf(f) ?? "salé") === "salé",
  )
    ? "salé"
    : "sucré";

  const parts: RecipePart[] = [];
  for (const course of ["salé", "sucré"] as const) {
    const mine = members.filter((f) => (courseOf(f) ?? "salé") === course);
    if (mine.length === 0) continue;
    parts.push(
      buildPart(course, mine, course === fatCourse ? fats : [], texture),
    );
  }

  const savory = parts.find((p) => p.course === "salé");
  const sweet = parts.find((p) => p.course === "sucré");

  // Whatever attaches to no preparation closes the meal.
  const extraSteps: RecipeStep[] = [];

  // ── Stirred-in doses ────────────────────────────────────────────────────
  // Compote first: sweetness masks the bitterness of a nut butter far better
  // than a vegetable purée does. Except for what the catalogue explicitly
  // sends to the savoury side (mustard, tofu).
  for (const f of addons) {
    if (!f.prep_note) continue;
    const host = courseOf(f) === "salé" ? (savory ?? sweet) : (sweet ?? savory);
    const text = host
      ? `${lower(f.prep_note)} dans ${host.name}.`
      : `${lower(f.prep_note)}.`;
    (host ? host.steps : extraSteps).push({ lead: f.name, text });
  }

  // ── Served alongside ────────────────────────────────────────────────────
  // Dairy is given plain, next to the compote: mixing it would mask the taste
  // of the fruit alone. A crust of bread is chewed, not blended. The step
  // closes the preparation the food attaches to — its place in the block
  // already says "alongside", no need to write it.
  for (const f of apart) {
    if (!f.prep_note) continue;
    const host = parts.find((p) => p.course === courseOf(f));
    const step = { lead: f.name, text: `${lower(f.prep_note)}.` };
    (host ? host.steps : extraSteps).push(step);
  }

  return { lines, parts, extraSteps };
}

/**
 * The menu at a glance, for the card header: "purée haricot vert & œuf dur, puis
 * compote de pomme". It is the only line a parent reads when they just want to
 * know what they are cooking tonight — the detailed composition and the steps
 * sit below, for when they actually start.
 *
 * The "de" only appears with a single food ("purée de courge"): past two it
 * would weigh the sentence down for nothing.
 */
export function menuGlance(recipe: ComposedRecipe): {
  /** One entry per preparation, in serving order. */
  dishes: string[];
  /** What is served alongside, part of no preparation. */
  sides: string[];
} {
  const dishes = recipe.parts.map((part) => {
    // Fat stays out of the headline: nobody says "on the menu, leek purée and
    // rapeseed oil". It stays in the steps and in the composition, where it has a
    // quantity.
    const names = recipe.lines
      .filter(
        (l) => l.course === part.course && l.category !== "matière grasse",
      )
      .map((l) => lower(l.name));
    const base = bareName(part.name);
    if (names.length === 0) return base;
    return names.length === 1
      ? `${base} ${withDe(names[0])}`
      : `${base} ${names.join(" & ")}`;
  });

  return {
    dishes,
    sides: recipe.lines.filter((l) => l.course === null).map((l) => l.name),
  };
}

/** "la purée" → "purée": the bare noun, to sit inside a list. */
function bareName(name: string): string {
  return name.replace(/^l[ae] /, "");
}

function buildPart(
  course: RecipeCourse,
  members: RecipeFood[],
  fats: RecipeFood[],
  texture: string,
): RecipePart {
  const steamed = members.filter((f) => cookMethodOf(f) === "vapeur");
  const boiled = members.filter((f) => cookMethodOf(f) === "eau");
  const raw = members.filter((f) => cookMethodOf(f) === "aucune");

  // A starch boiled in water is blended into the purée while the texture is
  // smooth, and served alongside as soon as the child eats lumps: pasta blended
  // at 11 months would be a step back (ESPGHAN window 8-10 months).
  const chunky = texture === MORSELS;
  // `slotGroupOf` rather than `category === "féculent"`: since 0023 pasta is a
  // grain and lentils a pulse, and all three count as the meal's starch.
  const side = boiled.filter(
    (f) => chunky && slotGroupOf(f.category) === "féculent",
  );
  const mixed = members.filter((f) => !side.includes(f));
  const cooksInMix = mixed.some((f) => cookMethodOf(f) !== "aucune");

  const name = partName(course, steamed.length > 0, chunky);
  const steps: RecipeStep[] = [];

  // 1. Separately-cooked foods first: they run while you peel. Their
  //    `prep_note` carries the whole cook, duration included — the code adds not
  //    one second (that was the bug that re-steamed the hard-boiled egg).
  for (const f of boiled) {
    if (f.prep_note)
      steps.push({
        lead: f.name,
        text: `${lower(f.prep_note)}.`,
        minutes: f.cook_minutes ?? undefined,
      });
  }

  // 2. Prep for what goes into the steamer.
  for (const f of steamed) {
    if (f.prep_note)
      steps.push({ lead: f.name, text: `${lower(f.prep_note)}.` });
  }

  // 3. One steam cook per preparation, timed on the longest food.
  if (steamed.length > 0) {
    const minutes = Math.max(...steamed.map((f) => f.cook_minutes ?? 0));
    const names = joinNames(steamed.map((f) => lower(f.name)));
    steps.push({
      text:
        steamed.length === 1
          ? `Cuis à la vapeur ${minutes} min, jusqu'à ce que ce soit bien tendre.`
          : `Mets ${names} à cuire ensemble à la vapeur ${minutes} min.`,
      minutes,
    });
  }

  // 4. What goes in raw, once the cooking is done.
  for (const f of raw) {
    if (f.prep_note)
      steps.push({ lead: f.name, text: `${lower(f.prep_note)}.` });
  }

  // 5. Blending. Pointless when the preparation is a single raw food: its own
  //    action ("écrase-la à la fourchette") already says it all.
  if (mixed.length > 1 || cooksInMix) {
    const names =
      mixed.length === 1 ? "" : joinNames(mixed.map((f) => lower(f.name)));
    const liquid = cooksInMix
      ? "en ajoutant un peu d'eau de cuisson si besoin"
      : "en ajoutant un peu d'eau si besoin";
    steps.push({ text: `${blendVerb(names, texture)}, ${liquid}.` });
  }

  // 6. Fat: into the preparation, never into the pan. After blending — raw is
  //    how rapeseed oil keeps its omega-3 — and before what is served
  //    alongside, which does not get any.
  if (fats.length > 0) {
    const names = joinNames(fats.map((f) => lower(f.name)));
    steps.push({
      text: `Ajoute ${spoons(fats.length)} ${withDe(names)} dans ${name}, hors du feu.`,
    });
  }

  // 7. The starch kept whole, served alongside.
  for (const f of side) {
    steps.push({ lead: f.name, text: "à servir à côté, en petits morceaux." });
  }

  return { course, name, steps };
}

/**
 * The texturing action, with the verb that fits: "mixer en écrasé à la
 * fourchette" is not something you say. Empty `names` = the preparation holds a
 * single food, which the previous step just named.
 */
function blendVerb(names: string, texture: string): string {
  const what = names
    ? ` ${names}${names.includes(" et ") ? " ensemble" : ""}`
    : "";
  if (texture === MORSELS)
    return `Écrase${what} grossièrement, en gardant de petits morceaux fondants`;
  if (texture === MASHED) return `Écrase${what} à la fourchette`;
  return `Mixe${what} en ${texture}`;
}

/**
 * How to name the preparation in a sentence. "La compote" implies cooked fruit;
 * a mashed mango is a dessert, not a compote. "La purée" implies we still blend.
 */
function partName(
  course: RecipeCourse,
  cooked: boolean,
  chunky: boolean,
): string {
  if (course === "sucré") return cooked ? "la compote" : "le dessert";
  return chunky ? "le plat" : "la purée";
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * "de" + name, with elision. Without it: "1 c. à café de huile de colza". The
 * silent h in the catalogue is limited to "huile"; "haricot" is aspirated and
 * does not elide.
 */
function withDe(name: string): string {
  return /^([aeiouyàâéèêëîïôöûüœ]|hui)/i.test(name)
    ? `d'${name}`
    : `de ${name}`;
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

function spoons(n: number): string {
  return n === 1 ? "1 c. à café" : `${n} c. à café`;
}
