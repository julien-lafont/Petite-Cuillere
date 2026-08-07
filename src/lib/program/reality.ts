/**
 * Ce que la vraie vie impose au plan — LOGIQUE PURE (aucune I/O).
 * Voir docs/feats/suivi-reel-et-rattrapage.md.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * L'ASYMÉTRIE DE CONFIANCE
 *
 * Un repas passé resté « prévu » est ambigu : le parent n'a peut-être rien
 * tapé, ou l'enfant n'a peut-être rien mangé. On tranche différemment selon le
 * coût de l'erreur.
 *
 *   DÉCOUVERTE — présumée faite. Se tromper coûte peu : l'aliment revient dans
 *     la rotation. Bloquer le programme sur un parent silencieux coûterait le
 *     produit entier.
 *   ALLERGÈNE — non confirmé. Se tromper voudrait dire croire l'enfant protégé
 *     alors qu'il n'a jamais touché à l'arachide. Le coût est un préjudice de
 *     santé, donc on exige une confirmation explicite.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * LE RACCORD AVEC LE GÉNÉRATEUR
 *
 * `buildPlan` avance en gardant deux choses en mémoire d'un jour sur l'autre :
 * la découverte à répéter demain, et l'allergène dont la dose de montée reste à
 * servir. Replanifier en cours de route, c'est reprendre ces deux fils là où le
 * réel les a laissés — c'est tout l'objet de `PlanReality`.
 */

import { addDays, toISODate } from "@/lib/dates";

/** Un repas réel, réduit à ce dont la dérivation a besoin. */
export type RealMeal = {
  date: string;
  momentId: string | null;
  status: "prevu" | "servi" | "remplace" | "saute";
  locked: boolean;
  result: "bien" | "moyen" | "refuse" | null;
  items: {
    foodId: string;
    skipped: boolean;
    /** Allergène porté par cet aliment, s'il y en a un. */
    allergenId: string | null;
    /** Une dose prescrite signe une étape du protocole, pas un aliment ordinaire. */
    dose: string | null;
  }[];
  /** Allergènes explicitement rattachés au repas (`meal_allergens`). */
  allergenIds: string[];
};

/** Ce que le réel impose au plan à venir. Toutes les entrées sont facultatives. */
export type PlanReality = {
  /** Découverte de la veille encore à répéter aujourd'hui (R2). */
  repeatToday?: string | null;
  /** Allergène dont la dose de montée reste à servir (R7). */
  pendingAllergen?: { allergenId: string; foodId: string } | null;
  /** Créneaux fixés par le parent : jamais réécrits, mais pris en compte (R12). */
  locked?: { date: string; momentId: string; foodIds: string[] }[];
  /** Jours d'interruption à retrancher de l'ancienneté (R11). */
  interruptionDays?: number;
};

/** État de départ complet d'une replanification. */
export type DerivedState = {
  /** Aliments considérés comme connus de l'enfant (présomption incluse). */
  introducedFoodIds: string[];
  /** Allergènes réellement confirmés — la seule base admise par le protocole. */
  confirmedAllergenIds: string[];
  /**
   * Allergènes vus au programme mais jamais confirmés, avec le nombre de fois.
   * Au-delà de `MAX_ALLERGEN_RETRIES`, le programme cesse de les reproposer et
   * les signale au parent plutôt que de boucler indéfiniment (R6).
   */
  unconfirmedAllergens: { allergenId: string; attempts: number }[];
  /**
   * Allergènes que le programme cesse de reproposer faute de confirmation.
   * Ils rejoignent l'entretien — donc restent servis, ce qui expose l'enfant de
   * fait — mais s'affichent « à confirmer » dans Découvertes : le produit ne
   * prétend jamais savoir ce qu'il ne sait pas.
   */
  unconfirmedGiveUpIds: string[];
  reality: PlanReality;
};

/**
 * Nombre de fois qu'un allergène non confirmé est reproposé avant que le
 * programme passe à la suite. Une reproposition, pas davantage : sans ce
 * plafond, un parent qui ne confirme jamais bloquerait le calendrier sur l'œuf.
 */
export const MAX_ALLERGEN_RETRIES = 1;

/**
 * Durée minimale, en jours consécutifs sans aucun solide confirmé, à partir de
 * laquelle on considère la diversification interrompue (R11).
 */
export const INTERRUPTION_MIN_DAYS = 7;

const asDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).getTime() / 86_400_000;

/**
 * Dérive de l'histoire réelle tout ce dont `buildPlan` a besoin pour reprendre
 * le fil à partir de `fromISO` (exclu du passé, c'est le premier jour à générer).
 *
 * @param meals    tous les repas connus, passés comme à venir
 * @param fromISO  premier jour que la replanification va écrire
 */
export function deriveState(
  meals: RealMeal[],
  fromISO: string,
  options: {
    /** Aliments déclarés connus au rattrapage d'inscription. */
    priorIntroduced?: string[];
    /** Allergènes déclarés rencontrés au rattrapage d'inscription. */
    priorAllergens?: string[];
    /** Date du premier aliment solide, pour borner la recherche d'interruption. */
    diversificationStartedOn?: string | null;
  } = {},
): DerivedState {
  const past = meals
    .filter((m) => m.date < fromISO && m.momentId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const introduced = new Set(options.priorIntroduced ?? []);
  const confirmedAllergens = new Set(options.priorAllergens ?? []);
  const allergenAttempts = new Map<string, number>();

  for (const meal of past) {
    // Un repas non donné n'a rien exposé du tout.
    if (meal.status === "saute") {
      for (const id of meal.allergenIds) bump(allergenAttempts, id);
      continue;
    }

    for (const item of meal.items) {
      if (item.skipped) continue;
      introduced.add(item.foodId);
    }

    // Allergènes : confirmation exigée. Un item décoché ne compte pas non plus,
    // même si le reste du repas a bien été mangé.
    const servedAllergens = new Set(
      meal.items
        .filter((it) => !it.skipped && it.allergenId)
        .map((it) => it.allergenId!),
    );
    for (const id of meal.allergenIds) {
      const confirmed =
        (meal.status === "servi" || meal.status === "remplace") &&
        // Le lien `meal_allergens` peut survivre au retrait de son vecteur :
        // sans aliment porteur servi, il n'y a pas eu d'exposition.
        (servedAllergens.has(id) || meal.items.every((it) => !it.allergenId));
      if (confirmed) confirmedAllergens.add(id);
      else bump(allergenAttempts, id);
    }
  }

  const unconfirmed = [...allergenAttempts.entries()]
    .filter(([id]) => !confirmedAllergens.has(id))
    .map(([allergenId, attempts]) => ({ allergenId, attempts }));

  return {
    introducedFoodIds: [...introduced],
    confirmedAllergenIds: [...confirmedAllergens],
    unconfirmedAllergens: unconfirmed,
    unconfirmedGiveUpIds: unconfirmed
      .filter((u) => u.attempts > MAX_ALLERGEN_RETRIES)
      .map((u) => u.allergenId),
    reality: {
      repeatToday: pendingRepeat(past, introduced, fromISO),
      pendingAllergen: pendingAllergenMonte(past, confirmedAllergens, fromISO),
      locked: lockedSlots(meals, fromISO),
      interruptionDays: interruptionDays(
        past,
        options.diversificationStartedOn ?? null,
        fromISO,
      ),
    },
  };
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * La découverte de la veille à reproposer aujourd'hui (R2 et R5).
 *
 * Le guide veut chaque nouvel aliment servi deux jours d'affilée. On repère
 * donc ce qui a été goûté pour la première fois la veille et pas l'avant-veille
 * — que ce soit le programme ou le parent qui l'ait mis là, et que l'enfant
 * l'ait adoré ou refusé : un refus ne décale rien (décision G).
 */
function pendingRepeat(
  past: RealMeal[],
  introduced: Set<string>,
  fromISO: string,
): string | null {
  const yesterday = toISODate(addDays(new Date(`${fromISO}T00:00:00`), -1));
  const eatenOn = (dateISO: string) =>
    new Set(
      past
        .filter((m) => m.date === dateISO && m.status !== "saute")
        .flatMap((m) => m.items.filter((it) => !it.skipped))
        .map((it) => it.foodId),
    );

  const yesterdayFoods = eatenOn(yesterday);
  if (yesterdayFoods.size === 0) return null;

  // « Nouveau hier » = mangé hier, jamais avant. On remonte tout l'historique :
  // se fier aux deux derniers jours ferait répéter un aliment de rotation.
  const before = new Set(
    past
      .filter((m) => m.date < yesterday && m.status !== "saute")
      .flatMap((m) => m.items.filter((it) => !it.skipped))
      .map((it) => it.foodId),
  );

  for (const id of yesterdayFoods) {
    if (!before.has(id) && introduced.has(id)) return id;
  }
  return null;
}

/**
 * L'allergène dont la dose de montée reste due (R7 et R8).
 *
 * Le protocole tient en deux jours : une pointe de cuillère, puis la dose
 * cible. Si le second jour n'a pas eu lieu, on ne repart pas du test — le seuil
 * déjà toléré est acquis, et refaire le palier bas retarderait tout le monde
 * sans rien protéger de plus.
 *
 * On se fonde sur le **nombre d'expositions confirmées**, pas sur la présence
 * d'une dose prescrite : un œuf donné hors programme par le parent n'a pas de
 * dose en base, et doit pourtant déclencher la montée exactement comme s'il
 * avait été planifié (R8).
 */
function pendingAllergenMonte(
  past: RealMeal[],
  confirmed: Set<string>,
  fromISO: string,
): { allergenId: string; foodId: string } | null {
  const from = asDay(fromISO);

  // Expositions confirmées, par allergène : combien, quand, et par quel support.
  const seen = new Map<
    string,
    { count: number; lastDate: string; foodId: string }
  >();
  for (const meal of past) {
    if (meal.status !== "servi" && meal.status !== "remplace") continue;
    for (const item of meal.items) {
      if (item.skipped || !item.allergenId) continue;
      const cur = seen.get(item.allergenId);
      if (cur) {
        cur.count += 1;
        if (meal.date >= cur.lastDate) {
          cur.lastDate = meal.date;
          cur.foodId = item.foodId;
        }
      } else {
        seen.set(item.allergenId, {
          count: 1,
          lastDate: meal.date,
          foodId: item.foodId,
        });
      }
    }
  }

  for (const [allergenId, info] of seen) {
    if (!confirmed.has(allergenId)) continue;
    // Une seule exposition, toute récente : le test a eu lieu, la montée non.
    // Au-delà de deux jours, la montée n'a plus de sens — l'entretien prend le
    // relais et ramènera l'allergène de lui-même.
    if (info.count !== 1) continue;
    if (from - asDay(info.lastDate) > 2) continue;
    return { allergenId, foodId: info.foodId };
  }
  return null;
}

/**
 * Les créneaux que le parent a fixés lui-même à partir de `fromISO`. Le moteur
 * ne les réécrit pas, mais doit les connaître : sans cela la rotation
 * reproposerait le même aliment le lendemain, et une découverte faite par le
 * parent serait comptée deux fois.
 *
 * Un repas verrouillé et vide (« on ne sera pas là ») est une contrainte à part
 * entière : il occupe le créneau sans rien y mettre.
 */
function lockedSlots(
  meals: RealMeal[],
  fromISO: string,
): { date: string; momentId: string; foodIds: string[] }[] {
  return meals
    .filter(
      (m) =>
        m.date >= fromISO && m.momentId && (m.locked || m.status === "saute"),
    )
    .map((m) => ({
      date: m.date,
      momentId: m.momentId!,
      foodIds:
        m.status === "saute"
          ? []
          : m.items.filter((it) => !it.skipped).map((it) => it.foodId),
    }));
}

/**
 * Jours d'interruption à retrancher de l'ancienneté (R11).
 *
 * Un enfant qui n'a rien mangé de solide pendant trois semaines n'a pas
 * trois semaines d'expérience de plus. On ne compte que les trous longs et
 * fermés — une absence de deux jours fait partie de la vie normale, et le trou
 * en cours n'est pas encore un fait acquis.
 */
function interruptionDays(
  past: RealMeal[],
  startedOn: string | null,
  fromISO: string,
): number {
  const eaten = [
    ...new Set(
      past
        .filter(
          (m) => m.status !== "saute" && m.items.some((it) => !it.skipped),
        )
        .map((m) => m.date),
    ),
  ].sort();
  if (eaten.length === 0) return 0;

  const marks =
    startedOn && startedOn < eaten[0] ? [startedOn, ...eaten] : eaten;
  let total = 0;
  for (let i = 1; i < marks.length; i++) {
    const gap = asDay(marks[i]) - asDay(marks[i - 1]) - 1;
    if (gap >= INTERRUPTION_MIN_DAYS) total += gap;
  }
  // Le trou courant (depuis le dernier repas réel jusqu'à aujourd'hui) compte
  // aussi : c'est exactement le retour de vacances qu'on veut amortir.
  const trailing = asDay(fromISO) - asDay(marks[marks.length - 1]) - 1;
  if (trailing >= INTERRUPTION_MIN_DAYS) total += trailing;

  return Math.round(total);
}
