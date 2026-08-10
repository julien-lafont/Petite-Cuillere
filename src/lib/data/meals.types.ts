/** Types et helpers purs des repas — utilisables côté client comme serveur. */

export type MealResult = "bien" | "moyen" | "refuse" | null;

/**
 * Ce qui s'est réellement passé (cf. docs/feats/suivi-reel-et-rattrapage.md §3).
 *
 *   prevu    — le programme l'a écrit, le parent n'a rien dit
 *   servi    — donné, composition conforme
 *   remplace — donné, mais autre chose
 *   saute    — pas donné
 */
export type MealStatus = "prevu" | "servi" | "remplace" | "saute";

export type MealItem = {
  id: string;
  /**
   * Dose prescrite, quand il y en a une : les allergènes suivent un protocole
   * de montée (« une pointe de cuillère » le premier jour, la dose cible le
   * lendemain). NULL pour un aliment ordinaire, dont la quantité se déduit de
   * l'âge (`portionFor`).
   */
  dose: string | null;
  /** Qui a mis cet aliment là : le générateur, ou le parent. */
  source: "programme" | "parent";
  /** Cet aliment précis n'a pas été donné, alors que le reste du repas l'a été. */
  skipped: boolean;
  food: {
    id: string;
    name: string;
    category: string | null;
    is_allergen: boolean;
    allergen_type: string | null;
    texture: string | null;
    preparation: string | null;
    quantite_indicative: string | null;
    cook_minutes: number | null;
    prep_note: string | null;
    /** 'vapeur' | 'eau' | 'aucune' — cf. migration 0019 et `lib/recipe.ts`. */
    cook_method: string | null;
    /** 'salé' | 'sucré' — préparation d'accueil ; null = se sert seul. */
    course: string | null;
    /** Se sert tel quel, jamais mixé (laitage, croûte de pain). */
    served_apart: boolean | null;
    /** Portion propre à l'aliment, quand la catégorie ne dit pas la quantité. */
    portion_label: string | null;
    portion_grams: number | null;
    restrictions: string | null;
    season: number[][] | null;
  } | null;
};

export type MealAllergenLink = {
  id: string;
  allergen: { id: string; name: string } | null;
};

export type Observation = {
  id: string;
  effect_type: string | null;
  severity: string | null;
  delay: string | null;
  note: string | null;
  allergen_id: string | null;
  food_id: string | null;
};

export type MealWithDetails = {
  id: string;
  baby_id: string;
  date: string;
  meal_moment_id: string | null;
  result: MealResult;
  note: string | null;
  status: MealStatus;
  logged_at: string | null;
  /** Écriture de la ligne. Une replanification la renouvelle : c'est ce qui
   *  permet de dire « ceci est entré au programme depuis vos courses ». */
  created_at: string;
  /** Repas fixé par le parent : le moteur ne le réécrit jamais. */
  locked: boolean;
  /** Ce que le programme avait prévu avant correction — affichage seulement. */
  planned_food_ids: string[] | null;
  meal_items: MealItem[];
  meal_allergens: MealAllergenLink[];
  intake_observations: Observation[];
};

/**
 * Le parent s'est prononcé sur ce repas. C'est la seule preuve qu'il a eu lieu,
 * et donc la seule sur laquelle le protocole allergènes accepte de s'appuyer.
 */
export function isConfirmed(meal: { status: MealStatus }): boolean {
  return meal.status === "servi" || meal.status === "remplace";
}

/**
 * Ce repas compte-t-il comme une exposition aux aliments qu'il porte ?
 *
 * Tout sauf « sauté » : un repas passé sans signal est **présumé fait**. Se
 * tromper coûte peu (l'aliment revient dans la rotation), alors que bloquer le
 * programme sur un parent silencieux coûterait le produit entier. L'asymétrie
 * inverse ne vaut que pour les allergènes — voir `isConfirmed`.
 */
export function countsAsExposure(meal: { status: MealStatus }): boolean {
  return meal.status !== "saute";
}

/** Aliments réellement mangés : les items non décochés d'un repas non sauté. */
export function servedFoodIds(meal: {
  status: MealStatus;
  meal_items: { skipped: boolean; food: { id: string } | null }[];
}): string[] {
  if (!countsAsExposure(meal)) return [];
  return meal.meal_items
    .filter((it) => !it.skipped && it.food)
    .map((it) => it.food!.id);
}

/*
 * « Ce repas est-il derrière nous ? » ne se répond plus ici.
 *
 * Tant qu'un moment n'était qu'un rang, la seule réponse possible était « sa
 * date est passée », ce qui laissait le dîner de ce soir compter comme mangé
 * dès le réveil. La question demande maintenant l'heure : elle vit dans
 * `lib/moments.ts` — `isPastMeal` et `awaitsSignalAt` —, avec les créneaux qui
 * seuls savent y répondre.
 */

/** Brouillon d'un repas édité localement, persisté d'un coup via `saveMeal`. */
export type MealObservationDraft = {
  effect_type: string;
  severity: string;
  note: string;
};
/**
 * Ce que le parent est en train de faire. Détermine si l'enregistrement est une
 * prévision (qu'on verrouille) ou un compte rendu (qui pose un statut réel).
 */
export type MealIntent = "plan" | "log" | "evaluate";

export type MealDraft = {
  result: MealResult;
  note: string;
  foodIds: string[];
  allergenIds: string[];
  observations: MealObservationDraft[];
  intent?: MealIntent;
};

/** Nombre d'introductions par aliment / allergène jusqu'à une date. */
export type IntroductionCounts = {
  foods: Record<string, number>;
  allergens: Record<string, number>;
};

/** Clé de repérage d'un repas dans une grille : date + moment. */
export function mealKey(dateISO: string, momentId: string): string {
  return `${dateISO}|${momentId}`;
}

/** Indexe une liste de repas par (date, moment) pour un accès direct. */
export function indexMeals(
  meals: MealWithDetails[],
): Map<string, MealWithDetails> {
  const map = new Map<string, MealWithDetails>();
  for (const m of meals) {
    if (m.meal_moment_id) map.set(mealKey(m.date, m.meal_moment_id), m);
  }
  return map;
}
