/**
 * Quantités indicatives par repas, selon l'âge projeté du bébé et la catégorie
 * d'aliment. Répond à la question centrale de l'écran « Aujourd'hui » : « combien
 * dois-je en préparer ? » (cf. docs/ux-redesign.md §5).
 *
 * Repères (PNNS 4 + pratique pédiatrique courante) :
 *   · Légumes/fruits : ~2-3 c. à café au tout début (4 mois), puis montée
 *     progressive jusqu'à ~130 g vers 6 mois et ~150-200 g au-delà, selon l'appétit.
 *   · Protéines : ~10 g/jour avant 1 an (« 10 g par année d'âge »), un seul repas.
 *   · Matière grasse : 1 c. à café/jour dès le premier repas salé.
 *   · Féculents : ~¼ de la portion de légumes.
 *
 * ⚠️ Indicatif. On rappelle systématiquement de respecter l'appétit de l'enfant :
 * ces valeurs ne sont pas un objectif à atteindre.
 */

export type PortionCategory =
  | "légume"
  | "fruit"
  | "protéine"
  | "féculent"
  | "laitier"
  | "matière grasse"
  | "autre";

export type Portion = {
  /** Quantité affichable, ex. « ~120 g » ou « 1 c. à café ». */
  label: string;
  /** Grammes estimés, pour agréger la liste de courses (null si non pertinent). */
  grams: number | null;
};

/**
 * La part du catalogue qui peut contredire la règle par catégorie.
 *
 * Certains aliments sont bien de leur catégorie sans en suivre la quantité : le
 * pruneau est un dessert, mais on n'en donne pas 180 g — c'est un laxatif avant
 * d'être une compote. La catégorie dit *où* l'aliment se mange, elle ne sait pas
 * toujours dire *combien*. Cette portion-là est une propriété de l'aliment, elle
 * vit donc dans le catalogue (migration 0021) et non ici.
 */
export type FoodPortion = {
  portion_label: string | null;
  portion_grams: number | null;
};

/**
 * Grammes de légume/fruit pour un repas, en fonction de l'âge projeté (mois).
 * Courbe volontairement douce : on ne veut pas d'à-coups d'un mois sur l'autre.
 */
function vegFruitGrams(months: number): number {
  if (months < 4) return 0;
  if (months < 5) return 60; // débuts : quelques cuillères
  if (months < 6) return 120;
  if (months < 8) return 150;
  if (months < 10) return 180;
  return 200;
}

/** Grammes de protéine : ~10 g avant 1 an, un seul repas par jour. */
function proteinGrams(months: number): number {
  if (months < 5.5) return 0; // pas de protéine au tout début
  return 10;
}

/** Arrondi « de cuisine » : au multiple de 10 g le plus proche. */
function roundGrams(g: number): number {
  return Math.round(g / 10) * 10;
}

/**
 * Portion indicative d'un aliment pour un repas, selon la catégorie et l'âge.
 * Les catégories sans grammage utile (matière grasse, laitier, pain…) reçoivent
 * un libellé « ménager » plutôt qu'un poids.
 *
 * `food` permet à l'aliment d'imposer sa propre portion. C'est la dernière des
 * trois sources de quantité, par ordre de priorité décroissante : la dose du
 * protocole allergènes (appliquée en amont, dans `recipe.ts`), puis la portion
 * du catalogue, puis la règle par catégorie ci-dessous.
 */
export function portionFor(
  category: PortionCategory | string | null,
  months: number,
  food?: FoodPortion | null,
): Portion {
  if (food?.portion_label) {
    return { label: food.portion_label, grams: food.portion_grams };
  }

  switch (category) {
    case "légume":
    case "fruit": {
      const g = roundGrams(vegFruitGrams(months));
      return g > 0
        ? { label: `~${g} g`, grams: g }
        : { label: "quelques c.", grams: 20 };
    }
    case "protéine": {
      const g = proteinGrams(months);
      return g > 0
        ? { label: `~${g} g (2 c. à café)`, grams: g }
        : { label: "pas encore", grams: null };
    }
    case "féculent": {
      const g = roundGrams(vegFruitGrams(months) / 4);
      return { label: `~${g} g`, grams: g };
    }
    case "matière grasse":
      return { label: "1 c. à café", grams: 5 };
    case "laitier":
      return { label: "1 pot", grams: null };
    default:
      return { label: "petite portion", grams: null };
  }
}
