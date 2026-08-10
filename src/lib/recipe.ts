/**
 * Compose un pas-à-pas de cuisine à partir des aliments d'un repas et de l'âge
 * du bébé. Objectif : simple et efficace, avec un cuiseur-mixeur type Babycook —
 * pas de gastronomie (cf. docs/ux-redesign.md §5).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * UN REPAS N'EST PAS UNE ASSIETTE
 *
 * C'est l'erreur que faisait la première version : elle prenait tous les
 * aliments du repas, les jetait dans une cuisson vapeur unique calée sur le
 * temps le plus long, et n'en faisait qu'un seul mixage. Or le générateur pose
 * bien un fruit **et** un légume au même déjeuner dès 5,5 mois (`schedule.ts`) :
 * le fruit y est le dessert, pas un ingrédient de la purée. On obtenait donc
 * « mets courge, œuf dur et pêche à cuire ensemble à la vapeur ».
 *
 * Un repas se décompose en **préparations** séparées, jamais mélangées :
 *
 *   LE SALÉ   — légume, protéine, féculent, matière grasse. Mangé en premier.
 *   LE SUCRÉ  — les fruits. Une compote, en équivalent dessert.
 *
 * Et à l'intérieur d'une préparation, tout ne se cuit pas de la même façon :
 *
 *   vapeur — les légumes, les fruits à cuire, les viandes et poissons. Une
 *            seule cuisson commune, calée sur le plus long.
 *   eau    — l'œuf dur, le riz, les pâtes, la semoule, les légumineuses. Ils
 *            cuisent **à part**, dans leur eau ; les repasser à la vapeur
 *            ensuite serait absurde (l'œuf dur est déjà dur).
 *   aucune — l'avocat, la banane, le jambon. Incorporés après cuisson.
 *
 * Certains aliments enfin ne se mixent avec rien : un laitage se sert nature à
 * côté, une croûte de pain se mâchouille. C'est `served_apart` en base.
 *
 * Ces trois informations (méthode de cuisson, préparation d'accueil, service à
 * part) ne se devinent pas depuis la catégorie : elles vivent dans le catalogue,
 * comme le reste (`cook_method`, `course`, `served_apart` — cf. migration 0019).
 */

import { portionFor, type Portion } from "@/lib/portions";
import { textureFor } from "@/lib/program/schedule";
import type { Season } from "@/lib/season";
import type { MealItem } from "@/lib/data/meals.types";

export type RecipeStep = {
  /**
   * L'aliment que cette étape concerne, quand elle en vise un seul (« œuf
   * dur », « pomme »). Il ouvre l'étape en gras : l'œil retrouve l'ingrédient
   * dans la liste sans relire la phrase. Absent sur les étapes communes
   * (« cuis à la vapeur 15 min »), qui n'appartiennent à personne.
   */
  lead?: string;
  text: string;
  /** Minutes, si l'étape est une cuisson — pour un éventuel minuteur. */
  minutes?: number;
};

/** Les deux préparations d'un repas. Elles ne se mélangent jamais. */
export type RecipeCourse = "salé" | "sucré";

export type MealFoodLine = {
  id: string;
  name: string;
  category: string | null;
  isAllergen: boolean;
  portion: Portion;
  /**
   * Vrai quand la quantité affichée est une dose prescrite par le protocole
   * allergènes, et non une portion déduite de l'âge. La distinction compte pour
   * le parent : une pointe de cuillère de beurre de cacahuète est un palier à
   * respecter, pas un repère à ajuster selon l'appétit.
   */
  isPrescribedDose: boolean;
  /** Préparation dans laquelle cet aliment atterrit — null s'il se sert seul. */
  course: RecipeCourse | null;
  /**
   * Saison et restriction voyagent avec la ligne : ces deux informations se
   * lisent **sur l'aliment** (« courge · de saison », « miel — pas avant 12
   * mois »), pas dans un pavé de conseils en bas de fiche où elles obligeaient
   * le parent à refaire lui-même le rapprochement.
   */
  season: Season;
  restrictions: string | null;
};

export type RecipePart = {
  course: RecipeCourse;
  /**
   * Le nom de la préparation, écrit pour tenir en milieu de phrase (« dans la
   * compote ») autant qu'en titre. Il suit la texture : à l'âge des morceaux,
   * ce n'est plus une purée.
   */
  name: string;
  steps: RecipeStep[];
};

export type ComposedRecipe = {
  lines: MealFoodLine[];
  parts: RecipePart[];
  /** Ce qui ne relève d'aucune préparation : laitage nature, croûte de pain… */
  extraSteps: RecipeStep[];
};

/**
 * Texture cible. L'âge commande — la fenêtre des morceaux (8-10 mois selon
 * l'ESPGHAN) ne se décale pas parce que la diversification a commencé tard.
 * L'ancienneté ne peut que retenir le lisse, et seulement les tout premiers
 * jours : le seuil vit dans `program/schedule.ts`.
 */
export function textureForAge(months: number, tenureDays = Infinity): string {
  return textureFor(months, tenureDays);
}

type RecipeFood = NonNullable<MealItem["food"]>;

type CookMethod = "vapeur" | "eau" | "aucune";

const COOK_METHODS: readonly string[] = ["vapeur", "eau", "aucune"];

/** Les textures de `textureFor` (`schedule.ts`) qui ne se « mixent » plus. */
const MORSELS = "petits morceaux fondants";
const MASHED = "écrasé à la fourchette";

/** Catégories qui composent le plat salé, quand `course` n'est pas renseignée. */
const SAVORY_CATEGORIES: readonly string[] = [
  "légume", // l'avocat y est rangé exprès : il se sert écrasé dans une purée salée
  "protéine",
  "féculent",
  "matière grasse",
];

/**
 * Comment cet aliment cuit. Les replis ne servent qu'à une base pas encore
 * migrée : sans `cook_method`, on ne sait pas distinguer une cuisson à l'eau
 * d'une cuisson vapeur, et l'œuf dur repasse à la vapeur.
 */
function cookMethodOf(f: RecipeFood): CookMethod {
  const m = f.cook_method;
  if (m && COOK_METHODS.includes(m)) return m as CookMethod;
  return (f.cook_minutes ?? 0) > 0 ? "vapeur" : "aucune";
}

/** Dans quelle préparation cet aliment atterrit. Null = il se sert seul. */
function courseOf(f: RecipeFood): RecipeCourse | null {
  if (f.course === "salé" || f.course === "sucré") return f.course;
  if (f.category === "fruit") return "sucré";
  if (SAVORY_CATEGORIES.includes(f.category ?? "")) return "salé";
  return null;
}

/** Se sert tel quel, sans jamais être mixé avec le reste. */
function isServedApart(f: RecipeFood): boolean {
  if (typeof f.served_apart === "boolean") return f.served_apart;
  return f.category === "laitier";
}

/**
 * Une dose posée sur un repas plutôt qu'un aliment du repas : purée
 * d'oléagineux, moutarde, tofu. Elle se délaie dans une préparation existante —
 * c'est ainsi que `plan.ts` les place déjà (catégorie « autre »).
 */
function isAddon(f: RecipeFood): boolean {
  return f.category === "autre";
}

function isFat(f: RecipeFood): boolean {
  return f.category === "matière grasse";
}

/** Le salé d'abord, le sucré ensuite, ce qui se sert seul en dernier. */
function lineRank(course: RecipeCourse | null): number {
  return course === "salé" ? 0 : course === "sucré" ? 1 : 2;
}

/**
 * Construit la recette d'un repas. `months` pilote les quantités et la texture.
 */
export function composeRecipe(
  items: MealItem[],
  months: number,
): ComposedRecipe {
  const withFood = items.filter(
    (it): it is MealItem & { food: RecipeFood } => it.food !== null,
  );
  const foods = withFood.map((it) => it.food);

  // Les lignes suivent l'ordre des préparations, jamais celui du plan : lire
  // « courge · pêche · œuf dur » laisserait croire que tout va au même endroit.
  const lines: MealFoodLine[] = withFood
    .map(({ food: f, dose }) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      isAllergen: f.is_allergen,
      // La dose du protocole prime sur la portion calculée : c'est elle qui a
      // été planifiée, et l'afficher en « ~150 g » serait faux et dangereux.
      // Vient ensuite la portion propre à l'aliment, quand il en a une.
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

  // ── Répartition ─────────────────────────────────────────────────────────
  // Exclusive et dans cet ordre : un aliment servi à part n'entre nulle part,
  // une dose ne fait pas préparation, une matière grasse n'est pas un
  // ingrédient qu'on cuit.
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

  // Les matières grasses sont toujours crues et toujours dans le salé : une
  // cuillère d'huile de colza dans une compote n'a aucun sens. Sans plat salé —
  // cas que le générateur ne produit pas, mais qu'un parent peut composer à la
  // main — elles suivent la première préparation venue.
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

  // Ce qui ne se rattache à aucune préparation ferme le repas.
  const extraSteps: RecipeStep[] = [];

  // ── Doses délayées ──────────────────────────────────────────────────────
  // La compote d'abord : le sucré masque l'amertume d'une purée d'oléagineux
  // bien mieux qu'une purée de légumes. Sauf pour ce que le catalogue destine
  // explicitement au salé (moutarde, tofu).
  for (const f of addons) {
    if (!f.prep_note) continue;
    const host = courseOf(f) === "salé" ? (savory ?? sweet) : (sweet ?? savory);
    const text = host
      ? `${lower(f.prep_note)} dans ${host.name}.`
      : `${lower(f.prep_note)}.`;
    (host ? host.steps : extraSteps).push({ lead: f.name, text });
  }

  // ── Servis à part ───────────────────────────────────────────────────────
  // Un laitage se donne nature, à côté de la compote : le mélanger masquerait
  // le goût du fruit seul. Une croûte de pain se mâchouille, elle ne se mixe
  // pas. L'étape ferme la préparation à laquelle l'aliment se rattache — sa
  // place dans le bloc dit déjà « à côté », inutile de l'écrire.
  for (const f of apart) {
    if (!f.prep_note) continue;
    const host = parts.find((p) => p.course === courseOf(f));
    const step = { lead: f.name, text: `${lower(f.prep_note)}.` };
    (host ? host.steps : extraSteps).push(step);
  }

  return { lines, parts, extraSteps };
}

/**
 * Le menu en un coup d'œil, pour l'en-tête de la fiche : « purée haricot vert
 * & œuf dur, puis compote de pomme ». C'est la seule ligne que lit un parent
 * qui veut juste savoir ce qu'il cuisine ce soir — la composition détaillée et
 * le pas-à-pas sont dessous, pour quand il s'y met vraiment.
 *
 * Le « de » n'apparaît qu'avec un aliment unique (« purée de courge ») : passé
 * deux, il alourdirait la phrase sans rien apprendre.
 */
export function menuGlance(recipe: ComposedRecipe): {
  /** Une entrée par préparation, dans l'ordre de service. */
  dishes: string[];
  /** Ce qui se sert à côté, sans entrer dans aucune préparation. */
  sides: string[];
} {
  const dishes = recipe.parts.map((part) => {
    // La matière grasse n'entre pas dans l'annonce : personne ne dit « au menu,
    // purée de poireau et huile de colza ». Elle reste dans le pas-à-pas et
    // dans la composition, où elle a une quantité.
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

/** « la purée » → « purée » : le nom seul, pour entrer dans une énumération. */
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

  // Un féculent cuit à l'eau se mixe dans la purée tant que la texture est
  // lisse, et se sert à côté dès que l'enfant mange des morceaux : des pâtes
  // mixées à 11 mois seraient un retour en arrière (fenêtre ESPGHAN 8-10 mois).
  const chunky = texture === MORSELS;
  const side = boiled.filter((f) => chunky && f.category === "féculent");
  const mixed = members.filter((f) => !side.includes(f));
  const cooksInMix = mixed.some((f) => cookMethodOf(f) !== "aucune");

  const name = partName(course, steamed.length > 0, chunky);
  const steps: RecipeStep[] = [];

  // 1. Les cuissons à part en premier : elles tournent pendant qu'on épluche.
  //    Leur `prep_note` porte la cuisson complète, durée comprise — le code n'en
  //    rajoute pas une seconde (c'était le bug de l'œuf dur repassé à la vapeur).
  for (const f of boiled) {
    if (f.prep_note)
      steps.push({
        lead: f.name,
        text: `${lower(f.prep_note)}.`,
        minutes: f.cook_minutes ?? undefined,
      });
  }

  // 2. Préparation de ce qui part à la vapeur.
  for (const f of steamed) {
    if (f.prep_note)
      steps.push({ lead: f.name, text: `${lower(f.prep_note)}.` });
  }

  // 3. Une seule cuisson vapeur par préparation, calée sur le plus long.
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

  // 4. Ce qui s'ajoute cru, une fois la cuisson faite.
  for (const f of raw) {
    if (f.prep_note)
      steps.push({ lead: f.name, text: `${lower(f.prep_note)}.` });
  }

  // 5. Mixage. Inutile quand la préparation tient en un seul aliment cru : son
  //    geste (« écrase-la à la fourchette ») dit déjà tout.
  if (mixed.length > 1 || cooksInMix) {
    const names =
      mixed.length === 1 ? "" : joinNames(mixed.map((f) => lower(f.name)));
    const liquid = cooksInMix
      ? "en ajoutant un peu d'eau de cuisson si besoin"
      : "en ajoutant un peu d'eau si besoin";
    steps.push({ text: `${blendVerb(names, texture)}, ${liquid}.` });
  }

  // 6. Matière grasse : dans la préparation, jamais dans la casserole. Après le
  //    mixage — c'est cru que l'huile de colza garde ses oméga-3 — et avant ce
  //    qu'on sert à côté, qui ne la reçoit pas.
  if (fats.length > 0) {
    const names = joinNames(fats.map((f) => lower(f.name)));
    steps.push({
      text: `Ajoute ${spoons(fats.length)} ${withDe(names)} dans ${name}, hors du feu.`,
    });
  }

  // 7. Le féculent gardé entier, servi à côté.
  for (const f of side) {
    steps.push({ lead: f.name, text: "à servir à côté, en petits morceaux." });
  }

  return { course, name, steps };
}

/**
 * Le geste de mise en texture, avec le verbe qui va avec : « mixer en écrasé à
 * la fourchette » ne se dit pas. `names` vide = la préparation n'a qu'un
 * aliment, que l'étape précédente vient de nommer.
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
 * Comment nommer la préparation dans les phrases. « La compote » suppose des
 * fruits cuits ; une mangue écrasée est un dessert, pas une compote. « La
 * purée » suppose qu'on mixe encore.
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
 * « de » + nom, avec élision. Sans cela : « 1 c. à café de huile de colza ».
 * Le h muet du catalogue se limite à « huile » ; « haricot » est aspiré et ne
 * s'élide pas.
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
