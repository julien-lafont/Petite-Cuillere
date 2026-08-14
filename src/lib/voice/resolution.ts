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
 * Resolution — the half of the feature that depends on no model.
 *
 * Everything below is **pure**: same inputs, same outputs, no database and no
 * network. That is what lets it replay in the test suite, and above all what
 * guarantees the model never gets hold of an id, a date or a meal moment (§4.4).
 */

// ────────────────────────────────────────────────────────────────────────────
// Foods
// ────────────────────────────────────────────────────────────────────────────

/**
 * Comparison form of a food name: lowercase, unaccented, singular. "Haricots
 * verts" and "haricot vert" mean the same thing; speech does not tell them
 * apart, the catalogue does.
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
 * A text parameter from the model, or `undefined` when it is not really one.
 *
 * The model sometimes slips an empty string, a zero-width space, or a fragment
 * of its own call syntax into a field. An optional field filled with nothing
 * must count as absent, or "Je n'ai plus de courgette" comes back with a phantom
 * substitute instead of the three suggestions.
 */
function text(value: string | undefined): string | undefined {
  const clean = value?.replace(/[\p{C}\p{Zs}]+/gu, " ").trim();
  if (!clean) return undefined;
  // A stray tag fragment, or the word the model writes when it has nothing to
  // write, are not food names.
  if (/[<>{}]|antml/i.test(clean)) return undefined;
  // "non_dit" is the value the tools ask the model to write when the parent said
  // nothing — a declared absence, not a name.
  if (/^(null|undefined|none|aucun|n\/a|placeholder|non_dit)$/i.test(clean))
    return undefined;
  // Not a single letter: "?", "—", "...". That is what the model writes to say
  // it does not know, on "remplace-le" with no substitute named.
  if (!/\p{L}/u.test(clean)) return undefined;
  return clean;
}

/** Edit distance, to catch "poirot" heard for "poireau". */
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
 * Fuzzy-match threshold. Deliberately set low: above it, "pruneau" starts to
 * look like "poireau", and the product invents an exposure nobody had.
 */
const FUZZY_THRESHOLD = 0.8;

/** Does the sought name appear whole, word for word, inside the other? */
function containsWords(haystack: string, needle: string): boolean {
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Finds a catalogue food from the name the parent said.
 *
 * Four passes, safest to most permissive: exact → normalised → by inclusion
 * ("purée de carotte" → Carotte) → fuzzy. A name that crosses all four without
 * settling stays `unknown`, and the app will offer to create the food. Never a
 * silent write (§9.2).
 */
export function resolveFood(
  spoken: string,
  catalog: FoodContext[],
): ResolvedFood {
  const raw = spoken.trim();
  if (!raw) return { state: "unknown", spoken };

  // An id is not a name. The tools ask the model to write the name (§4.4); an id
  // arriving here therefore comes from a model that stopped following its
  // instructions, and taking it as a designation would let it pick a food
  // without ever naming it to the parent. In the database ids are uuids, which
  // none of the four passes brings near a name — but that is a property of their
  // shape, not a guarantee, and it would fall the day an id became readable.
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

  // Inclusion: the most specific name wins, or "purée de pomme de terre" would
  // resolve to "Pomme".
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

  // Fuzzy, and only with the same first letter: that is what stops "pruneau"
  // from becoming "poireau".
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
// Moments
// ────────────────────────────────────────────────────────────────────────────

/**
 * The instant of the dictation, in the shape `lib/moments` expects.
 *
 * The context carries the time twice — as a string for the model, in minutes for
 * the rules. The second is the one that counts here.
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

/** The inferred slot: a day, a moment, and the admission that we are unsure. */
export type InferredSlot = {
  dateISO: string;
  moment: MomentContext;
  /** Nothing imposes itself: the parent has to decide (§7.4). */
  ambiguous: boolean;
};

/**
 * Has the parent already answered the current slot's meal?
 *
 * Used for the future tense: at 12:45, if lunch is already marked served, "il
 * mangera de la pomme" is no longer about it but about the snack.
 */
function alreadyReported(ctx: VoiceContext, date: string, momentId: string) {
  const meal = ctx.meals.find(
    (m) => m.date === date && m.momentId === momentId,
  );
  return meal !== undefined && meal.status !== "prevu";
}

/**
 * The slot chosen when the parent named none — and they almost never do.
 *
 * The day first, because it settles everything:
 *
 *   a day gone by  → the last meal of that day;
 *   a day to come  → the midday meal, the one we plan first.
 *
 * "Samedi" has already decided: the verb tense adds nothing, and that is
 * deliberately the behaviour from before time slots.
 *
 * Today, though, the VERB TENSE rules, crossed with the time it is
 * (docs/feats/creneaux-horaires.md §7.3):
 *
 *   past    → the current slot, else the last one finished;
 *   future  → the current slot if it has not been answered yet, else the next;
 *   present → the current slot, and NOTHING when we are between two — at 10:30,
 *             "il mange de la pomme" points at neither breakfast nor lunch, and
 *             guessing would mean writing an exposure nobody had.
 *
 * At the edges of the day we spill over by one day, once: at 5am "il a mangé"
 * means yesterday's dinner, at 11pm "il mangera" means tomorrow's breakfast. The
 * result is shown with its date and editable in one tap — we save a gesture, we
 * do not decide for the parent.
 *
 * With no verb tense (the model omitted a field that is nonetheless required) we
 * fall back to the original behaviour: the last meal whose time has passed,
 * never changing day.
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
    // The meal closest to midday: it is the one we plan first.
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

  // Present tense. Inside a slot there is nothing to guess.
  if (current) return plain(current);

  // Between two meals: we offer the nearest in time, and say so.
  // A tie → the one coming, because "il mange" looks forward.
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

/** The question asked when no slot imposes itself. */
export function ambiguityQuestion(ctx: VoiceContext): string {
  const previous = lastEndedMoment(ctx.moments, ctx.nowMinutes);
  const upcoming = nextMoment(ctx.moments, ctx.nowMinutes);
  if (previous && upcoming) {
    return `${previous.label} ou ${upcoming.label} ?`;
  }
  return "De quel repas parlez-vous ?";
}

// ────────────────────────────────────────────────────────────────────────────
// The slot
// ────────────────────────────────────────────────────────────────────────────

const DAY_OFFSETS: Record<string, number> = {
  aujourd_hui: 0,
  hier: -1,
  avant_hier: -2,
  demain: 1,
  apres_demain: 2,
};

/** The server counts the days. The model only named them. */
export function resolveDate(
  day: string | undefined,
  dateISO: string | undefined,
  todayISO: string,
): string | null {
  if (day === "date_iso" || (!day && dateISO)) {
    if (!dateISO || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return null;
    // A far-off date is more likely a hallucination than an intent: we would
    // rather write nothing.
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
    // The inference can change day at the edges of the day: at 5am a past tense
    // means yesterday.
    date: inferred.dateISO,
    dateLabel: dateLabel(inferred.dateISO, ctx.today),
    momentId: inferred.moment.id,
    momentLabel: inferred.moment.label,
    momentInferred: true,
    momentAmbiguous: inferred.ambiguous,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Full resolution
// ────────────────────────────────────────────────────────────────────────────

/** The child meant: the one the parent named, else the one on screen. */
function resolveBaby(firstName: string | undefined, ctx: VoiceContext) {
  const active = ctx.babies.find((b) => b.active) ?? ctx.babies[0];
  if (!firstName) return active;
  const target = normalize(firstName);
  return ctx.babies.find((b) => normalize(b.firstName) === target) ?? active;
}

/** The context meal matching a slot, if there is one. */
function mealAt(ctx: VoiceContext, date: string, momentId: string) {
  return ctx.meals.find((m) => m.date === date && m.momentId === momentId);
}

/**
 * Finds the slot that actually carries the food to replace.
 *
 * "Remplace le panais de demain" does not say which meal: rather than guessing a
 * slot, we look for the one where the food is actually on the menu. It is the
 * one inference that cannot be wrong.
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

/** Ids of a meal's foods, as the catalogue recognises them. */
function foodIdsOf(names: string[], ctx: VoiceContext): string[] {
  return names
    .map((name) => resolveFood(name, ctx.foods))
    .filter((food) => food.state === "resolved")
    .map((food) => food.id);
}

export type ResolveOptions = {
  /** Key generator — injected so tests stay deterministic. */
  key?: (index: number) => string;
};

/**
 * Turns the model's intents into runnable ones.
 *
 * Each intent is validated **independently**: a shaky one does not take another
 * down with it. Rejecting a whole dictation because one word is missing loses
 * the parent — the suivi réel rule applies here too (§4.5).
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
      // A replacement with no food to replace is not an incomplete intent, it
      // is a stray call: it has nothing to say to the parent.
      if (!missingName) return;
      const missing = resolveFood(missingName, ctx.foods);
      const requestedDate =
        intent.params.jour || intent.params.date_iso
          ? resolveDate(intent.params.jour, intent.params.date_iso, ctx.today)
          : null;

      // The slot carrying the food wins over any clock-based inference.
      const holder =
        missing.state === "resolved" && !intent.params.moment_id
          ? slotHolding(missing.name, requestedDate, ctx)
          : null;
      const date = holder?.date ?? requestedDate ?? ctx.today;
      // Replacement does not go through the verb tense: the slot that carries
      // the food decides, and failing that the historical inference.
      const slot = resolveSlot(
        date,
        intent.params.moment_id ?? holder?.momentId,
        ctx,
      );

      const replacementName = text(intent.params.remplacant);
      const proposed = replacementName
        ? resolveFood(replacementName, ctx.foods)
        : null;
      // Replacing a food with itself is not a replacement: the model sometimes
      // copies the field across. We treat it as an unnamed substitute, and the
      // three suggestions take over.
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
      // A date we cannot count does not become "today" by default: better to
      // say so than to write on the wrong day.
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
    // No slot imposes itself: the intent goes out anyway, foods included, but it
    // waits for a tap. Throwing away the whole sentence over a missing slot
    // loses the parent (§4.5, §7.4).
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
          // "non_dit" is an answer from the model, not a product value.
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

    // Defence in depth. `understand()` already drops tools it does not know,
    // but this function must not depend on that filtering: without this test an
    // invented tool fell into the remaining branch and became a rating on a
    // meal. A tool name we do not know does not run — it disappears.
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
 * Structural signature of an intent — what makes it interchangeable with
 * another.
 */
function signature(intent: ResolvedIntent): string {
  const detail = intent.detail;
  if (detail.type === "askClarification") {
    return `${intent.babyId}|askClarification|${detail.question}`;
  }
  const slot = `${intent.babyId}|${detail.type}|${detail.slot.date}|${detail.slot.momentId}`;
  if (detail.type === "logMeal") {
    // The rating is out of the signature: it is precisely the field the model
    // forgets in one of the two calls it emits twice.
    return `${slot}|${foodSignature(detail.foods)}|${detail.nature}`;
  }
  if (detail.type === "skipMeal") return `${slot}|${detail.cancel}`;
  if (detail.type === "rateMeal") return `${slot}|${detail.appreciation}`;
  const missing =
    detail.missing.state === "resolved"
      ? detail.missing.id
      : detail.missing.spoken;
  // The substitute is out of the signature, for the same reason as the rating:
  // it is the field the model forgets in one of the two calls. A food is only
  // replaced once per slot anyway.
  return `${slot}|${missing}`;
}

/** A meal's foods, in a comparable and stable form. */
function foodSignature(foods: ResolvedFood[]): string {
  return foods
    .map((food) =>
      food.state === "resolved" ? food.id : `?${normalize(food.spoken)}`,
    )
    .sort()
    .join(",");
}

/**
 * Folds what the model said several times back into one intent.
 *
 * Two behaviours, seen on the §11 test set and absorbed here rather than fought
 * with prompt tweaks:
 *
 *   - **the plain duplicate.** The same intent emitted two or three times.
 *     Unguarded, the card would show the same block twice — and two
 *     `remplacer_aliment` in a row would swap two foods instead of one.
 *   - **over-splitting.** "Il a mangé des carottes à midi et il a adoré"
 *     sometimes comes back as two calls: the meal, then the rating. But that is
 *     one intent (§4.5) — two writes on the same slot would trigger two replans
 *     for nothing. So we fold the rating into the meal that already carries it.
 */
function collapse(intents: ResolvedIntent[]): ResolvedIntent[] {
  const kept: ResolvedIntent[] = [];
  const byKey = new Map<string, ResolvedIntent>();

  for (const intent of intents) {
    const key = signature(intent);
    const twin = byKey.get(key);
    if (twin) {
      // Sometimes the duplicate brings exactly one thing: the missing rating.
      if (
        twin.detail.type === "logMeal" &&
        intent.detail.type === "logMeal" &&
        !twin.detail.appreciation &&
        intent.detail.appreciation
      ) {
        twin.detail.appreciation = intent.detail.appreciation;
      }
      // Of the two replacements, the one that names a substitute wins: it
      // carries the whole intent, with its validation and its substitutes
      // computed accordingly. We swap the entry rather than stitching its
      // fields back together one by one.
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

  // A rating placed on the slot of a meal we have just composed belongs to that
  // meal.
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
 * Execution order: past reports first, forecasts after.
 *
 * Order matters, because every write triggers `replanFrom` and the plan must see
 * the past before the future is imposed on it (§4.5).
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
