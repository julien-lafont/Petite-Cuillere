/**
 * Turns a total number of grams, aggregated over a period, into a concrete
 * purchase quantity: "4 courgettes", "1 kg de carottes", "300 g de poulet" (see
 * docs/ux-redesign.md §6).
 *
 * Foods sold by unit are converted from grams to a piece count via an average
 * unit weight. Foods that make no sense by the piece — meat, dry starches, dairy
 * — stay expressed by weight.
 *
 * ⚠️ Indicative estimates: we round up a little to cover peeling and cooking
 * losses, and always invite adjusting to the child's appetite.
 */

/**
 * Average weight of one piece, in grams, for foods sold by unit.
 *
 * This weight is compared against a need expressed as food *eaten*: for pieces
 * where a large share is thrown away (rind, stone), we record the weight of
 * usable flesh, not the shelf weight — `WASTE_FACTOR` only covers ordinary
 * losses (≈ 20 %), nowhere near a melon's 50 %.
 */
const UNIT_WEIGHT: Record<
  string,
  { grams: number; unit: string; unitPlural: string }
> = {
  Carotte: { grams: 70, unit: "carotte", unitPlural: "carottes" },
  Courgette: { grams: 200, unit: "courgette", unitPlural: "courgettes" },
  Potiron: {
    grams: 400,
    unit: "part de potiron",
    unitPlural: "parts de potiron",
  },
  Courge: { grams: 400, unit: "part de courge", unitPlural: "parts de courge" },
  "Blanc de poireau": { grams: 100, unit: "poireau", unitPlural: "poireaux" },
  Brocoli: { grams: 300, unit: "brocoli", unitPlural: "brocolis" },
  Panais: { grams: 130, unit: "panais", unitPlural: "panais" },
  Navet: { grams: 130, unit: "navet", unitPlural: "navets" },
  Fenouil: { grams: 250, unit: "fenouil", unitPlural: "fenouils" },
  Tomate: { grams: 120, unit: "tomate", unitPlural: "tomates" },
  // Vacuum-packed cooked beetroot, the kind you buy: skin off, the rest used.
  Betterave: { grams: 150, unit: "betterave", unitPlural: "betteraves" },
  // Flesh only: a 300 g aubergine yields ≈ 250 (skin + large seeds).
  Aubergine: { grams: 250, unit: "aubergine", unitPlural: "aubergines" },
  // Flesh only: a 200 g pepper yields ≈ 150 (stalk, seeds, ribs).
  Poivron: { grams: 150, unit: "poivron", unitPlural: "poivrons" },
  // Flesh only: a 200 g avocado yields ≈ 140 (skin + stone).
  Avocat: { grams: 140, unit: "avocat", unitPlural: "avocats" },
  Pomme: { grams: 150, unit: "pomme", unitPlural: "pommes" },
  Poire: { grams: 170, unit: "poire", unitPlural: "poires" },
  Banane: { grams: 120, unit: "banane", unitPlural: "bananes" },
  // Flesh only: a 350 g mango yields ≈ 220 (skin + flat stone).
  Mangue: { grams: 220, unit: "mangue", unitPlural: "mangues" },
  Abricot: { grams: 50, unit: "abricot", unitPlural: "abricots" },
  Pêche: { grams: 150, unit: "pêche", unitPlural: "pêches" },
  // Flesh only: a 900 g charentais yields ≈ 450 (rind + seeds).
  Melon: { grams: 450, unit: "melon", unitPlural: "melons" },
  // A pitted prune is ≈ 9 g. The catalogue portion is worth two: it is the only
  // food whose grams do not come from `portionFor`.
  Pruneau: { grams: 9, unit: "pruneau", unitPlural: "pruneaux" },
  "Pomme de terre": {
    grams: 120,
    unit: "pomme de terre",
    unitPlural: "pommes de terre",
  },
  "Patate douce": {
    grams: 250,
    unit: "patate douce",
    unitPlural: "patates douces",
  },
  "Œuf dur": { grams: 55, unit: "œuf", unitPlural: "œufs" },
};

/** Foods nobody buys "per meal": we show a plain reminder instead. */
const PANTRY = new Set([
  "Huile de colza",
  "Huile de noix",
  "Beurre",
  "Beurre de cacahuète",
  "Miel",
  "Semoule",
  "Riz",
  "Pâtes",
  "Pain",
]);

/** Margin for peeling and losses (≈ +20 %). */
const WASTE_FACTOR = 1.2;

/**
 * Readable purchase quantity for a food, from the grams planned over the period.
 * `grams` may be null (a portion with no weight) → a "selon besoin" quantity.
 */
export function purchaseLabel(
  name: string,
  category: string | null,
  grams: number | null,
  meals: number,
): string {
  if (PANTRY.has(name)) return "à avoir dans les placards";
  if (category === "laitier") {
    return `${meals} pot${meals > 1 ? "s" : ""}`;
  }
  if (grams === null || grams === 0) {
    return `${meals} portion${meals > 1 ? "s" : ""}`;
  }

  const needed = grams * WASTE_FACTOR;
  const unit = UNIT_WEIGHT[name];
  if (unit) {
    const pieces = Math.max(1, Math.ceil(needed / unit.grams));
    return `${pieces} ${pieces > 1 ? unit.unitPlural : unit.unit}`;
  }

  // Otherwise by weight, rounded for a shopping trip (50 g, then 100 g past 400 g).
  if (needed >= 1000) return `${(Math.ceil(needed / 100) / 10).toFixed(1)} kg`;
  if (needed >= 400) return `${Math.ceil(needed / 100) * 100} g`;
  return `${Math.ceil(needed / 50) * 50} g`;
}
