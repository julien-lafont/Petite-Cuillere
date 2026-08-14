/**
 * The programme's thresholds — PURE LOGIC, single source.
 *
 * The generator (`plan.ts`) and the explanations shown to the parent
 * (`stage.ts`, the "méthode" page) both read this module: a threshold exists
 * only here, and changing the programme automatically changes what we say about
 * it.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TWO CLOCKS
 *
 * A child starting diversification at 7 months cannot receive straight away what
 * a 7-month-old three months in receives. But shifting them "by three months"
 * would be worse: three things hang off calendar age, not elapsed time, and
 * delaying them does documented harm.
 *
 *   · Lumps. ESPGHAN puts lumpy textures at 8-10 months at the latest. Past
 *     9-10 months, the ALSPAC cohort finds lower fruit and vegetable intake at
 *     age 7, and more eating difficulties.
 *   · The allergen window, 4-12 months: delaying does not protect.
 *   · Iron: birth stores run out around 6 months, and over 90 % of needs must
 *     then come from solid food.
 *
 * Hence two tables and an intersection:
 *
 *   AGE     (`AGE_RULES`)    — ceiling. What the child is allowed to receive.
 *   ELAPSED (`TENURE_RULES`) — ramp. What their experience lets them absorb.
 *
 * A category is open only when **both** tables open it. Since the ramp counts in
 * days where the age table counts in months, a late start catches up in weeks
 * instead of staying behind.
 *
 * Non-regression check: for a start at 4 months, the age table is the binding
 * one everywhere — the original behaviour is preserved.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SOURCES
 *
 * Calendar and order: the Aiguelongue paediatric practice guide, followed to
 * the letter — 7 vegetables then fruit "10 to 15 days later", protein around
 * 5.5 months, starches and fat at 6 months, a second diversified meal around
 * 8-9 months. Completed by PNNS 4 (2022) and ESPGHAN (2017).
 */

export type MomentType =
  "petit-dej" | "dejeuner" | "gouter" | "diner" | "autre";

/** Categories the generator places in a slot. */
export const SLOT_CATEGORIES = [
  "légume",
  "fruit",
  "protéine",
  "féculent",
  "laitier",
] as const;

export const DAYS_PER_MONTH = 30.4375;

type AgeTier = { minAge: number; cats: string[] };
type TenureTier = { minDay: number; cats: string[] };

/**
 * AGE CEILING — in months of projected age (corrected for prematurity).
 * None of these bounds moves when diversification starts late.
 */
const AGE_RULES: Record<MomentType, AgeTier[]> = {
  // A solid breakfast closes diversification: the family takes over.
  "petit-dej": [{ minAge: 12, cats: ["féculent", "laitier"] }],
  dejeuner: [
    { minAge: 4, cats: ["légume"] },
    // 5.5 months: the guide's full meal — protein, and fruit for dessert.
    { minAge: 5.5, cats: ["légume", "protéine", "fruit"] },
    { minAge: 6, cats: ["légume", "protéine", "féculent", "fruit"] },
  ],
  // The guide opens fruit "10 to 15 days" after the first vegetable, not at a
  // given age: the age bound here is only a floor (diversification does not
  // start before 4 months, so fruit cannot arrive before 4.5). `TENURE_RULES` is
  // what really decides.
  gouter: [
    { minAge: 4.5, cats: ["fruit"] },
    { minAge: 6, cats: ["fruit", "laitier"] },
  ],
  // 8.5 months: "2 diversified meals around 9 months" (guide). The previous
  // threshold was 7 months, ahead of the source.
  diner: [{ minAge: 8.5, cats: ["légume", "féculent"] }],
  autre: [{ minAge: 6, cats: ["légume", "féculent"] }],
};

/**
 * ELAPSED-TIME RAMP — in days since the first solid food.
 *
 * What the child can handle, not what they are allowed to eat. Counted in days:
 * the WHO puts 2 to 3 meals a day from 6-8 months, so a late start must catch up
 * with its age in weeks, not months.
 */
const TENURE_RULES: Record<MomentType, TenureTier[]> = {
  "petit-dej": [{ minDay: 50, cats: ["féculent", "laitier"] }],
  dejeuner: [
    { minDay: 0, cats: ["légume"] },
    // D8: protein. Iron floor — a child starting at 6 months or later cannot
    // spend six weeks on vegetables alone.
    { minDay: 8, cats: ["légume", "protéine"] },
    { minDay: 15, cats: ["légume", "protéine", "féculent", "fruit"] },
  ],
  // The guide's 7 vegetables, two days each, take exactly fourteen days; the
  // threshold sits at D13 so the first fruit lands on the fifteenth day — "10 to
  // 15 days after" the first vegetable, says the guide — and not two days later,
  // once the repetition is over.
  gouter: [
    { minDay: 13, cats: ["fruit"] },
    { minDay: 22, cats: ["fruit", "laitier"] },
  ],
  diner: [{ minDay: 36, cats: ["légume", "féculent"] }],
  autre: [{ minDay: 36, cats: ["légume", "féculent"] }],
};

/** Age (months) from which a fat is added to savoury meals. */
export const FAT_FROM_MONTHS = 6;

/**
 * How many days the texture stays smooth no matter what. A child starting at 9
 * months has never eaten purée: they need a few days of smooth — but only a few,
 * since ESPGHAN explicitly advises against prolonging it.
 */
export const SMOOTH_TEXTURE_DAYS = 10;

/** Durée de la montée en quantité initiale (2-3 c. à café → 50-60 g). */
export const RAMP_UP_DAYS = 7;

export function classifyMoment(label: string): MomentType {
  const l = label.toLowerCase();
  if (l.includes("petit")) return "petit-dej";
  if (l.includes("déj") || l.includes("dej") || l.includes("midi"))
    return "dejeuner";
  if (l.includes("goût") || l.includes("gout") || l.includes("collation"))
    return "gouter";
  if (l.includes("dîn") || l.includes("din") || l.includes("soir"))
    return "diner";
  return "autre";
}

function tierCats<T extends { cats: string[] }>(
  tiers: T[],
  passes: (t: T) => boolean,
): string[] {
  let cats: string[] = [];
  for (const t of tiers) if (passes(t)) cats = t.cats;
  return cats;
}

/**
 * Categories open in a slot: the intersection of the age ceiling and the
 * elapsed-time ramp. Empty = the slot stays on milk.
 */
export function slotCats(
  type: MomentType,
  ageMonths: number,
  tenureDays: number,
): string[] {
  const byAge = tierCats(AGE_RULES[type], (t) => ageMonths >= t.minAge);
  if (byAge.length === 0) return [];
  const byTenure = tierCats(TENURE_RULES[type], (t) => tenureDays >= t.minDay);
  return byAge.filter((c) => byTenure.includes(c));
}

export function slotCatsForLabel(
  label: string,
  ageMonths: number,
  tenureDays: number,
): string[] {
  return slotCats(classifyMoment(label), ageMonths, tenureDays);
}

/** Age in months at which a moment opens — for explaining, not generating. */
export function momentOpensAtMonths(label: string): number {
  const tiers = AGE_RULES[classifyMoment(label)];
  return Math.min(...tiers.map((t) => t.minAge));
}

/** Elapsed days at which a moment opens — for explaining, not generating. */
export function momentOpensAtDay(label: string): number {
  const tiers = TENURE_RULES[classifyMoment(label)];
  return Math.min(...tiers.map((t) => t.minDay));
}

/**
 * Recommended texture. Age rules; elapsed time can only hold back the smooth
 * texture, and only for the first few days.
 */
export function textureFor(ageMonths: number, tenureDays: number): string {
  if (tenureDays < SMOOTH_TEXTURE_DAYS) return "purée bien lisse";
  if (ageMonths < 8) return "purée bien lisse";
  if (ageMonths < 10) return "écrasé à la fourchette";
  return "petits morceaux fondants";
}

/**
 * Ramp-up factor for quantities over the first week: "2 to 3 teaspoons, then 50
 * to 60 g within a week" (guide). Applies to elapsed time, not age — a child
 * starting at 8 months also starts small.
 */
export function portionRampFactor(tenureDays: number): number {
  if (tenureDays >= RAMP_UP_DAYS) return 1;
  return 0.35 + (0.65 * tenureDays) / RAMP_UP_DAYS;
}

/** Days elapsed at a given date. `startedOn` null = counted from `fallbackISO`. */
export function tenureDaysAt(
  dateISO: string,
  startedOnISO: string | null,
  fallbackISO: string,
): number {
  const from = new Date(`${startedOnISO ?? fallbackISO}T00:00:00`);
  const day = new Date(`${dateISO}T00:00:00`);
  return Math.floor((day.getTime() - from.getTime()) / 86_400_000);
}
