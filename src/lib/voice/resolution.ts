import { addISODays, diffISODays } from "@/lib/clock";
import { fromISODate } from "@/lib/dates";
import {
  currentMoment,
  lastEndedMoment,
  lastEndedSlot,
  nextMoment,
  nextSlot,
  sortMoments,
  type Instant,
} from "@/lib/moments";
import { findSubstitutes } from "@/lib/program/substitute";
import type {
  FoodContext,
  MomentContext,
  ResolvedFood,
  ResolvedIntent,
  ResolvedSlot,
  RawIntent,
  Tense,
  VoiceContext,
} from "@/lib/voice/types";

/**
 * La résolution — la moitié de la fonctionnalité qui ne dépend d'aucun modèle.
 *
 * Tout ce qui suit est **pur** : mêmes entrées, mêmes sorties, sans base ni
 * réseau. C'est ce qui permet de le rejouer dans le jeu de tests, et c'est
 * surtout ce qui garantit que le modèle n'a jamais la main sur un identifiant,
 * une date ou un moment de repas (§4.4).
 */

// ────────────────────────────────────────────────────────────────────────────
// Les aliments
// ────────────────────────────────────────────────────────────────────────────

/**
 * Forme de comparaison d'un nom d'aliment : minuscules, sans accent, au
 * singulier. « Haricots verts » et « haricot vert » désignent la même chose ;
 * l'oral ne fait pas la différence, le catalogue si.
 */
export function normalize(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 ? word.replace(/[sx]$/, "") : word))
    .join(" ");
}

/**
 * Un paramètre texte du modèle, ou `undefined` s'il n'en est pas vraiment un.
 *
 * Le modèle glisse parfois dans un champ une chaîne vide, une espace de largeur
 * nulle, ou un débris de sa propre syntaxe d'appel. Un champ facultatif rempli
 * de vide doit valoir « absent », sans quoi « Je n'ai plus de courgette »
 * ressort avec un remplaçant fantôme au lieu des trois substituts.
 */
function text(value: string | undefined): string | undefined {
  const clean = value?.replace(/[\p{C}\p{Zs}]+/gu, " ").trim();
  if (!clean) return undefined;
  // Un débris de balise, ou le mot que le modèle écrit quand il n'a rien à
  // écrire, ne sont pas des noms d'aliments.
  if (/[<>{}]|antml/i.test(clean)) return undefined;
  // « non_dit » est la valeur que les outils demandent au modèle d'écrire quand
  // le parent n'a rien dit — c'est une absence déclarée, pas un nom.
  if (/^(null|undefined|none|aucun|n\/a|placeholder|non_dit)$/i.test(clean))
    return undefined;
  // Pas une seule lettre : « ? », « — », « ... ». C'est ce que le modèle écrit
  // pour dire qu'il ne sait pas, sur « remplace-le » sans remplaçant nommé.
  if (!/\p{L}/u.test(clean)) return undefined;
  return clean;
}

/** Distance d'édition, pour rattraper « poirot » entendu pour « poireau ». */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const previous = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return row[b.length];
}

/**
 * Seuil de la correspondance approchée. Réglé vers le bas volontairement :
 * au-delà, « pruneau » se met à ressembler à « poireau », et le produit invente
 * une exposition que personne n'a eue.
 */
const FUZZY_THRESHOLD = 0.8;

/** Le nom cherché apparaît-il en entier, mot à mot, dans l'autre ? */
function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Retrouve un aliment du catalogue à partir du nom dit par le parent.
 *
 * Quatre passes, de la plus sûre à la plus permissive : exacte → normalisée →
 * par inclusion (« purée de carotte » → Carotte) → approchée. Un nom qui
 * traverse les quatre sans se poser reste `unknown`, et l'application proposera
 * de créer l'aliment. Jamais d'écriture silencieuse (§9.2).
 */
export function resolveFood(
  spoken: string,
  catalog: FoodContext[],
): ResolvedFood {
  const raw = spoken.trim();
  if (!raw) return { state: "unknown", spoken };

  // Un identifiant n'est pas un nom. Les outils demandent au modèle d'écrire le
  // nom (§4.4) ; un id qui arrive ici vient donc d'un modèle qui a cessé de
  // suivre ses consignes, et le prendre pour une désignation reviendrait à lui
  // laisser choisir un aliment sans jamais le nommer au parent. En base les id
  // sont des uuid, qu'aucune des quatre passes ne rapproche d'un nom — mais
  // c'est une propriété de leur forme, pas une garantie, et elle tomberait le
  // jour où un id deviendrait lisible.
  if (catalog.some((f) => f.id === raw)) return { state: "unknown", spoken };

  const exact = catalog.find((f) => f.name === raw);
  if (exact) {
    return {
      state: "resolved",
      id: exact.id,
      name: exact.name,
      spoken: raw,
      approximate: false,
    };
  }

  const target = normalize(raw);
  const normalized = catalog.map((food) => ({
    food,
    key: normalize(food.name),
  }));

  const same = normalized.find((c) => c.key === target);
  if (same) {
    return {
      state: "resolved",
      id: same.food.id,
      name: same.food.name,
      spoken: raw,
      approximate: false,
    };
  }

  // Inclusion : le nom le plus spécifique gagne, sans quoi « purée de pomme de
  // terre » se résoudrait en « Pomme ».
  const included = normalized
    .filter((c) => containsWords(target, c.key) || containsWords(c.key, target))
    .sort((a, b) => b.key.length - a.key.length)[0];
  if (included) {
    return {
      state: "resolved",
      id: included.food.id,
      name: included.food.name,
      spoken: raw,
      approximate: true,
    };
  }

  // Approchée, et seulement à initiale identique : c'est ce qui empêche
  // « pruneau » de devenir « poireau ».
  let best: { food: FoodContext; score: number } | null = null;
  for (const { food, key } of normalized) {
    if (key[0] !== target[0]) continue;
    const score =
      1 - editDistance(target, key) / Math.max(target.length, key.length);
    if (score >= FUZZY_THRESHOLD && (!best || score > best.score)) {
      best = { food, score };
    }
  }
  if (best) {
    return {
      state: "resolved",
      id: best.food.id,
      name: best.food.name,
      spoken: raw,
      approximate: true,
    };
  }

  return { state: "unknown", spoken: raw };
}

// ────────────────────────────────────────────────────────────────────────────
// Les moments
// ────────────────────────────────────────────────────────────────────────────

/**
 * L'instant de la dictée, sous la forme que `lib/moments` attend.
 *
 * Le contexte transporte l'heure deux fois — en chaîne pour le modèle, en
 * minutes pour les règles. C'est la seconde qui compte ici.
 */
function instantOf(ctx: VoiceContext): Instant {
  return { todayISO: ctx.today, minutes: ctx.nowMinutes };
}

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** « aujourd'hui », « hier », sinon « samedi 9 août ». */
export function dateLabel(dateISO: string, todayISO: string): string {
  const offset = diffISODays(todayISO, dateISO);
  const names: Record<number, string> = {
    "-2": "avant-hier",
    "-1": "hier",
    0: "aujourd'hui",
    1: "demain",
    2: "après-demain",
  };
  return names[offset] ?? DATE_FORMAT.format(fromISODate(dateISO));
}

/** Le créneau déduit : un jour, un moment, et l'aveu qu'on n'est pas sûr. */
export type InferredSlot = {
  dateISO: string;
  moment: MomentContext;
  /** Rien ne s'impose : le parent doit trancher (§7.4). */
  ambiguous: boolean;
};

/**
 * Le repas du créneau en cours a-t-il déjà reçu une réponse du parent ?
 *
 * Sert au futur : à 12 h 45, si le déjeuner est déjà noté « servi », « il
 * mangera de la pomme » ne parle plus de lui mais du goûter.
 */
function alreadyReported(ctx: VoiceContext, date: string, momentId: string) {
  const meal = ctx.meals.find(
    (m) => m.date === date && m.momentId === momentId,
  );
  return meal !== undefined && meal.status !== "prevu";
}

/**
 * Le créneau retenu quand le parent n'en a pas nommé — et il n'en nomme presque
 * jamais.
 *
 * Le jour d'abord, parce qu'il tranche tout :
 *
 *   un jour écoulé → le dernier repas de la journée ;
 *   un jour à venir → le repas de midi, celui qu'on planifie en premier.
 *
 * « Samedi » a déjà décidé : le temps du verbe n'y ajoute rien, et c'est
 * volontairement le comportement d'avant les créneaux.
 *
 * Aujourd'hui, en revanche, c'est le TEMPS DU VERBE qui commande, croisé avec
 * l'heure qu'il est (docs/feats/creneaux-horaires.md §7.3) :
 *
 *   passé    → le créneau en cours, sinon le dernier terminé ;
 *   futur    → le créneau en cours s'il n'a pas déjà été renseigné, sinon le
 *              prochain ;
 *   présent  → le créneau en cours, et RIEN quand on est entre deux — à 10 h 30,
 *              « il mange de la pomme » ne désigne ni le petit-déjeuner ni le
 *              déjeuner, et deviner reviendrait à écrire une exposition que
 *              personne n'a eue.
 *
 * Aux bords de la journée on déborde d'un jour, une seule fois : à 5 h « il a
 * mangé » vise le dîner d'hier, à 23 h « il mangera » vise le petit-déjeuner de
 * demain. Le résultat est affiché avec sa date et modifiable d'un tap — on
 * épargne un geste, on ne décide pas à la place du parent.
 *
 * Sans temps du verbe (le modèle a omis un champ pourtant obligatoire), on
 * retombe sur le comportement historique : le dernier repas dont l'heure est
 * passée, sans jamais changer de jour.
 */
export function inferSlot(
  dateISO: string,
  tense: Tense | undefined,
  ctx: VoiceContext,
): InferredSlot {
  const ordered = sortMoments(ctx.moments);
  const now = instantOf(ctx);
  const plain = (moment: MomentContext): InferredSlot => ({
    dateISO,
    moment,
    ambiguous: false,
  });

  if (dateISO > ctx.today) {
    // Le repas le plus proche de midi : c'est celui qu'on planifie en premier.
    const noon = 12 * 60;
    return plain(
      ordered.reduce((best, moment) =>
        Math.abs(moment.startMinute - noon) < Math.abs(best.startMinute - noon)
          ? moment
          : best,
      ),
    );
  }
  if (dateISO < ctx.today) return plain(ordered[ordered.length - 1]);

  const current = currentMoment(ordered, ctx.nowMinutes);

  if (!tense) {
    return plain(lastEndedMoment(ordered, ctx.nowMinutes) ?? ordered[0]);
  }

  if (tense === "passe") {
    if (current) return plain(current);
    const previous = lastEndedSlot(ordered, now)!;
    return {
      dateISO: previous.dateISO,
      moment: previous.moment,
      ambiguous: false,
    };
  }

  if (tense === "futur") {
    if (current && !alreadyReported(ctx, dateISO, current.id)) {
      return plain(current);
    }
    const upcoming = nextSlot(ordered, now)!;
    return {
      dateISO: upcoming.dateISO,
      moment: upcoming.moment,
      ambiguous: false,
    };
  }

  // Présent. Dans un créneau, il n'y a rien à deviner.
  if (current) return plain(current);

  // Entre deux repas : on propose le plus proche dans le temps, et on le dit.
  // Égalité → celui qui vient, parce qu'« il mange » regarde devant.
  const previous = lastEndedMoment(ordered, ctx.nowMinutes);
  const upcoming = nextMoment(ordered, ctx.nowMinutes);
  const backwards = previous ? ctx.nowMinutes - previous.endMinute : Infinity;
  const forwards = upcoming ? upcoming.startMinute - ctx.nowMinutes : Infinity;
  const nearest =
    forwards <= backwards ? (upcoming ?? previous) : (previous ?? upcoming);

  return {
    dateISO,
    moment: nearest ?? ordered[0],
    ambiguous: true,
  };
}

/** La question posée quand aucun créneau ne s'impose. */
export function ambiguityQuestion(ctx: VoiceContext): string {
  const previous = lastEndedMoment(ctx.moments, ctx.nowMinutes);
  const upcoming = nextMoment(ctx.moments, ctx.nowMinutes);
  if (previous && upcoming) {
    return `${previous.label} ou ${upcoming.label} ?`;
  }
  return "De quel repas parlez-vous ?";
}

// ────────────────────────────────────────────────────────────────────────────
// Le créneau
// ────────────────────────────────────────────────────────────────────────────

const DAY_OFFSETS: Record<string, number> = {
  aujourd_hui: 0,
  hier: -1,
  avant_hier: -2,
  demain: 1,
  apres_demain: 2,
};

/** Le serveur compte les jours. Le modèle s'est contenté de les nommer. */
export function resolveDate(
  day: string | undefined,
  dateISO: string | undefined,
  todayISO: string,
): string | null {
  if (day === "date_iso" || (!day && dateISO)) {
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
    // Une date lointaine est plus probablement une hallucination qu'une
    // intention : on préfère ne rien écrire.
    const offset = diffISODays(todayISO, dateISO);
    return offset >= -60 && offset <= 365 ? dateISO : null;
  }
  const offset = DAY_OFFSETS[day ?? "aujourd_hui"];
  if (offset === undefined) return null;
  return addISODays(todayISO, offset);
}

function resolveSlot(
  dateISO: string,
  momentId: string | undefined,
  ctx: VoiceContext,
  tense?: Tense,
): ResolvedSlot {
  const named = momentId
    ? ctx.moments.find((m) => m.id === momentId)
    : undefined;
  if (named) {
    return {
      date: dateISO,
      dateLabel: dateLabel(dateISO, ctx.today),
      momentId: named.id,
      momentLabel: named.label,
      momentInferred: false,
      momentAmbiguous: false,
    };
  }

  const inferred = inferSlot(dateISO, tense, ctx);
  return {
    // La déduction peut changer de jour aux bords de la journée : à 5 h, un
    // passé composé vise hier.
    date: inferred.dateISO,
    dateLabel: dateLabel(inferred.dateISO, ctx.today),
    momentId: inferred.moment.id,
    momentLabel: inferred.moment.label,
    momentInferred: true,
    momentAmbiguous: inferred.ambiguous,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// La résolution complète
// ────────────────────────────────────────────────────────────────────────────

/** L'enfant visé : celui que le parent a nommé, sinon celui affiché à l'écran. */
function resolveBaby(firstName: string | undefined, ctx: VoiceContext) {
  const active = ctx.babies.find((b) => b.active) ?? ctx.babies[0];
  if (!firstName) return active;
  const target = normalize(firstName);
  return ctx.babies.find((b) => normalize(b.firstName) === target) ?? active;
}

/** Le repas du contexte correspondant à un créneau, s'il existe. */
function mealAt(ctx: VoiceContext, date: string, momentId: string) {
  return ctx.meals.find((m) => m.date === date && m.momentId === momentId);
}

/**
 * Retrouve le créneau qui porte réellement l'aliment à remplacer.
 *
 * « Remplace le panais de demain » ne dit pas à quel repas : plutôt que de
 * deviner un créneau au hasard, on cherche celui où l'aliment est effectivement
 * au menu. C'est la seule déduction qui ne peut pas se tromper.
 */
function slotHolding(
  foodName: string,
  dateISO: string | null,
  ctx: VoiceContext,
): { date: string; momentId: string } | null {
  const target = normalize(foodName);
  const candidates = ctx.meals
    .filter((m) => (dateISO ? m.date === dateISO : m.date >= ctx.today))
    .sort((a, b) => a.date.localeCompare(b.date));

  const found = candidates.find((m) =>
    m.foods.some((name) => normalize(name) === target),
  );
  return found ? { date: found.date, momentId: found.momentId } : null;
}

/** Identifiants des aliments d'un repas, tels que le catalogue les reconnaît. */
function foodIdsOf(names: string[], ctx: VoiceContext): string[] {
  return names
    .map((name) => resolveFood(name, ctx.foods))
    .filter((food) => food.state === "resolved")
    .map((food) => food.id);
}

export type ResolveOptions = {
  /** Générateur de clés — injecté pour que les tests restent déterministes. */
  key?: (index: number) => string;
};

/**
 * Traduit les intentions du modèle en intentions exécutables.
 *
 * Chaque intention est validée **indépendamment** : une intention bancale n'en
 * emporte pas une autre. Rejeter toute une dictée parce qu'un mot manque, c'est
 * perdre le parent — la règle du suivi réel s'applique ici aussi (§4.5).
 */
export function resolveIntents(
  raw: RawIntent[],
  ctx: VoiceContext,
  options: ResolveOptions = {},
): ResolvedIntent[] {
  const makeKey = options.key ?? ((index: number) => `i${index}`);
  const discovered = new Set(
    foodIdsOf(
      ctx.discovered.map((d) => d.name),
      ctx,
    ),
  );

  const resolved: ResolvedIntent[] = [];

  raw.forEach((intent, index) => {
    const key = makeKey(index);

    if (intent.tool === "demander_precision") {
      const active = resolveBaby(undefined, ctx);
      resolved.push({
        key,
        babyId: active.id,
        babyName: active.firstName,
        ready: false,
        issue: null,
        detail: {
          type: "askClarification",
          question: intent.params.question,
          options: intent.params.options ?? [],
        },
      });
      return;
    }

    const baby = resolveBaby(text(intent.params.enfant), ctx);
    const identity = { key, babyId: baby.id, babyName: baby.firstName };

    if (intent.tool === "remplacer_aliment") {
      const missingName = text(intent.params.aliment_absent);
      // Un remplacement sans aliment à remplacer n'est pas une intention
      // incomplète, c'est un appel parasite : il n'a rien à dire au parent.
      if (!missingName) return;
      const missing = resolveFood(missingName, ctx.foods);
      const requestedDate =
        intent.params.jour || intent.params.date_iso
          ? resolveDate(intent.params.jour, intent.params.date_iso, ctx.today)
          : null;

      // Le créneau qui porte l'aliment prime sur toute déduction horaire.
      const holder =
        missing.state === "resolved" && !intent.params.moment_id
          ? slotHolding(missing.name, requestedDate, ctx)
          : null;
      const date = holder?.date ?? requestedDate ?? ctx.today;
      // Le remplacement ne passe pas par le temps du verbe : c'est le créneau
      // qui porte l'aliment qui décide, et à défaut la déduction historique.
      const slot = resolveSlot(
        date,
        intent.params.moment_id ?? holder?.momentId,
        ctx,
      );

      const replacementName = text(intent.params.remplacant);
      const proposed = replacementName
        ? resolveFood(replacementName, ctx.foods)
        : null;
      // Remplacer un aliment par lui-même n'est pas un remplacement : le modèle
      // recopie parfois le champ. On le traite comme un remplaçant non dit, et
      // les trois substituts reprennent la main.
      const replacement =
        proposed?.state === "resolved" &&
        missing.state === "resolved" &&
        proposed.id === missing.id
          ? null
          : proposed;

      const missingFood =
        missing.state === "resolved"
          ? (ctx.foods.find((f) => f.id === missing.id) ?? null)
          : null;
      const substitutes =
        missingFood && replacement?.state !== "resolved"
          ? findSubstitutes(
              {
                id: missingFood.id,
                name: missingFood.name,
                category: missingFood.category,
                age_introduction_min: missingFood.minAgeMonths,
              },
              ctx.foods.map((f) => ({
                id: f.id,
                name: f.name,
                category: f.category,
                age_introduction_min: f.minAgeMonths,
              })),
              {
                introducedIds: discovered,
                ageMonths: baby.ageMonths,
                exclude: new Set(
                  foodIdsOf(
                    mealAt(ctx, slot.date, slot.momentId)?.foods ?? [],
                    ctx,
                  ),
                ),
              },
            ).map((f) => ({ id: f.id, name: f.name }))
          : [];

      const located = holder !== null || Boolean(intent.params.moment_id);
      const issue =
        missing.state !== "resolved"
          ? `« ${missing.spoken} » n'est pas au catalogue : impossible de le remplacer.`
          : !located
            ? `${missing.name} n'est pas au menu de ce jour-là — choisissez le repas concerné.`
            : replacement && replacement.state !== "resolved"
              ? `« ${replacement.spoken} » n'est pas au catalogue.`
              : !replacement
                ? "Choisissez le remplaçant."
                : null;

      resolved.push({
        ...identity,
        ready:
          missing.state === "resolved" &&
          replacement?.state === "resolved" &&
          located,
        issue,
        detail: {
          type: "substituteFood",
          slot,
          missing,
          replacement,
          substitutes,
        },
      });
      return;
    }

    const date = resolveDate(
      intent.params.jour,
      intent.params.date_iso,
      ctx.today,
    );
    if (!date) {
      // Une date qu'on ne sait pas compter ne devient pas « aujourd'hui » par
      // défaut : on préfère le dire plutôt que d'écrire au mauvais jour.
      resolved.push({
        ...identity,
        ready: false,
        issue: "Le jour n'a pas été compris.",
        detail: {
          type: "askClarification",
          question: "De quel jour parlez-vous ?",
          options: [],
        },
      });
      return;
    }
    const slot = resolveSlot(
      date,
      intent.params.moment_id,
      ctx,
      intent.params.temps,
    );
    // Aucun créneau ne s'impose : l'intention part quand même, avec ses aliments
    // compris, mais elle attend un tap. Jeter la phrase entière pour un créneau
    // manquant, c'est perdre le parent (§4.5, §7.4).
    const ambiguity = slot.momentAmbiguous ? ambiguityQuestion(ctx) : null;

    if (intent.tool === "noter_repas") {
      const foods = (intent.params.aliments ?? [])
        .map((name) => text(name))
        .filter((name): name is string => Boolean(name))
        .map((name) => resolveFood(name, ctx.foods));
      const unknown = foods.filter((f) => f.state === "unknown");
      resolved.push({
        ...identity,
        ready: foods.length > 0 && unknown.length === 0 && !ambiguity,
        issue:
          foods.length === 0
            ? "Aucun aliment n'a été compris."
            : unknown.length > 0
              ? `${unknown.map((f) => `« ${f.spoken} »`).join(", ")} : inconnu du catalogue.`
              : ambiguity,
        detail: {
          type: "logMeal",
          slot,
          foods,
          // « non_dit » est une réponse du modèle, pas une valeur du produit.
          appreciation:
            intent.params.appreciation &&
            intent.params.appreciation !== "non_dit"
              ? intent.params.appreciation
              : null,
          nature: intent.params.nature ?? "constat",
        },
      });
      return;
    }

    if (intent.tool === "repas_non_donne") {
      resolved.push({
        ...identity,
        ready: !ambiguity,
        issue: ambiguity,
        detail: {
          type: "skipMeal",
          slot,
          cancel: intent.params.annuler === true,
        },
      });
      return;
    }

    // Défense en profondeur. `understand()` écarte déjà les outils qu'il ne
    // connaît pas, mais cette fonction ne doit pas dépendre de ce filtrage :
    // sans ce test, un outil inventé tombait dans la branche restante et
    // devenait une note sur un repas. Un nom d'outil qu'on ne connaît pas ne
    // s'exécute pas — il disparaît.
    if (intent.tool !== "noter_appreciation") return;

    resolved.push({
      ...identity,
      ready: !ambiguity,
      issue: ambiguity,
      detail: {
        type: "rateMeal",
        slot,
        appreciation: intent.params.appreciation,
      },
    });
  });

  return sortChronologically(collapse(resolved), ctx);
}

/**
 * Signature structurelle d'une intention — ce qui la rend interchangeable avec
 * une autre.
 */
function signature(intent: ResolvedIntent): string {
  const detail = intent.detail;
  if (detail.type === "askClarification") {
    return `${intent.babyId}|askClarification|${detail.question}`;
  }
  const slot = `${intent.babyId}|${detail.type}|${detail.slot.date}|${detail.slot.momentId}`;
  if (detail.type === "logMeal") {
    // L'appréciation est hors signature : c'est précisément le champ que le
    // modèle oublie dans l'un des deux appels qu'il émet en double.
    return `${slot}|${foodSignature(detail.foods)}|${detail.nature}`;
  }
  if (detail.type === "skipMeal") return `${slot}|${detail.cancel}`;
  if (detail.type === "rateMeal") return `${slot}|${detail.appreciation}`;
  const missing =
    detail.missing.state === "resolved"
      ? detail.missing.id
      : detail.missing.spoken;
  // Le remplaçant est hors signature, pour la même raison que l'appréciation :
  // c'est le champ que le modèle oublie dans l'un des deux appels. Un aliment
  // ne se remplace de toute façon qu'une fois par créneau.
  return `${slot}|${missing}`;
}

/** Les aliments d'un repas, sous une forme comparable et stable. */
function foodSignature(foods: ResolvedFood[]): string {
  return foods
    .map((food) =>
      food.state === "resolved" ? food.id : `?${normalize(food.spoken)}`,
    )
    .sort()
    .join(",");
}

/**
 * Ramène à une seule intention ce que le modèle a dit plusieurs fois.
 *
 * Deux comportements, observés sur le jeu de §11 et absorbés ici plutôt que
 * combattus à coups de prompt :
 *
 *   - **le doublon pur.** La même intention émise deux ou trois fois. Sans
 *     garde, la carte afficherait le même bloc en double — et deux
 *     `remplacer_aliment` de suite échangeraient deux aliments au lieu d'un.
 *   - **le sur-découpage.** « Il a mangé des carottes à midi et il a adoré »
 *     ressort parfois en deux appels : le repas, puis l'appréciation. Or c'est
 *     une seule intention (§4.5) — deux écritures sur le même créneau
 *     déclencheraient deux replanifications pour rien. On replie donc
 *     l'appréciation dans le repas qui la porte déjà.
 */
function collapse(intents: ResolvedIntent[]): ResolvedIntent[] {
  const kept: ResolvedIntent[] = [];
  const byKey = new Map<string, ResolvedIntent>();

  for (const intent of intents) {
    const key = signature(intent);
    const twin = byKey.get(key);
    if (twin) {
      // Le doublon n'apporte parfois qu'une chose : l'appréciation manquante.
      if (
        twin.detail.type === "logMeal" &&
        intent.detail.type === "logMeal" &&
        !twin.detail.appreciation &&
        intent.detail.appreciation
      ) {
        twin.detail.appreciation = intent.detail.appreciation;
      }
      // Des deux remplacements, celui qui nomme un remplaçant l'emporte : il
      // porte l'intention entière, avec sa validation et ses substituts déjà
      // calculés en conséquence. On échange l'entrée plutôt que d'en recoudre
      // les champs un à un.
      if (
        twin.detail.type === "substituteFood" &&
        intent.detail.type === "substituteFood" &&
        !twin.detail.replacement &&
        intent.detail.replacement
      ) {
        kept[kept.indexOf(twin)] = intent;
        byKey.set(key, intent);
      }
      continue;
    }
    byKey.set(key, intent);
    kept.push(intent);
  }

  // Une note posée sur le créneau d'un repas qu'on vient de composer appartient
  // à ce repas.
  const meals = kept.filter((i) => i.detail.type === "logMeal");
  return kept.filter((intent) => {
    if (intent.detail.type !== "rateMeal") return true;
    const rating = intent.detail;
    const host = meals.find(
      (meal) =>
        meal.babyId === intent.babyId &&
        meal.detail.type === "logMeal" &&
        meal.detail.slot.date === rating.slot.date &&
        meal.detail.slot.momentId === rating.slot.momentId,
    );
    if (!host || host.detail.type !== "logMeal") return true;
    host.detail.appreciation ??= rating.appreciation;
    return false;
  });
}

/**
 * L'ordre d'exécution : les constats passés d'abord, les prévisions ensuite.
 *
 * L'ordre compte, parce que chaque écriture déclenche `replanFrom` et que le
 * plan doit voir le passé avant qu'on lui impose l'avenir (§4.5).
 */
export function sortChronologically(
  intents: ResolvedIntent[],
  ctx: VoiceContext,
): ResolvedIntent[] {
  const positions = new Map(ctx.moments.map((m) => [m.id, m.position]));
  const rank = (intent: ResolvedIntent) => {
    if (intent.detail.type === "askClarification")
      return { phase: 2, date: "", position: 0 };
    const forecast =
      intent.detail.type === "logMeal" && intent.detail.nature === "prevision";
    return {
      phase: forecast ? 1 : 0,
      date: intent.detail.slot.date,
      position: positions.get(intent.detail.slot.momentId) ?? 0,
    };
  };
  return [...intents].sort((a, b) => {
    const x = rank(a);
    const y = rank(b);
    return (
      x.phase - y.phase ||
      x.date.localeCompare(y.date) ||
      x.position - y.position
    );
  });
}
