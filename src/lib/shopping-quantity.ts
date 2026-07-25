/**
 * Traduit une quantité totale de grammes (agrégée sur une période) en une
 * quantité d'achat concrète et actionnable : « 4 courgettes », « 1 kg de
 * carottes », « 300 g de poulet » (cf. docs/ux-redesign.md §6).
 *
 * Pour les aliments vendus à l'unité, on convertit les grammes en nombre de
 * pièces via un poids unitaire moyen. Les aliments qui n'ont pas de sens « à la
 * pièce » (viande, féculents secs, laitages) restent exprimés en poids.
 *
 * ⚠️ Estimations indicatives : on majore légèrement pour couvrir l'épluchage et
 * les pertes de cuisson, et on invite toujours à ajuster à l'appétit de l'enfant.
 */

/** Poids moyen d'une pièce, en grammes, pour les aliments vendus à l'unité. */
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
  Pomme: { grams: 150, unit: "pomme", unitPlural: "pommes" },
  Poire: { grams: 170, unit: "poire", unitPlural: "poires" },
  Banane: { grams: 120, unit: "banane", unitPlural: "bananes" },
  Abricot: { grams: 50, unit: "abricot", unitPlural: "abricots" },
  Pêche: { grams: 150, unit: "pêche", unitPlural: "pêches" },
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

/** Aliments qu'on n'achète pas « par repas » : on affiche un simple rappel. */
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

/** Marge pour l'épluchage et les pertes (≈ +20 %). */
const WASTE_FACTOR = 1.2;

/**
 * Quantité d'achat lisible pour un aliment donné, à partir des grammes prévus
 * sur la période. `grams` peut être null (portion sans grammage) → quantité
 * « selon besoin ».
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

  // Sinon, en poids : arrondi « de course » (50 g, puis 100 g au-delà de 400 g).
  if (needed >= 1000) return `${(Math.ceil(needed / 100) / 10).toFixed(1)} kg`;
  if (needed >= 400) return `${Math.ceil(needed / 100) * 100} g`;
  return `${Math.ceil(needed / 50) * 50} g`;
}
