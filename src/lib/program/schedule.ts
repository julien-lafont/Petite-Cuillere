/**
 * Les seuils du programme — LOGIQUE PURE, source unique.
 *
 * Le générateur (`plan.ts`) et les explications affichées au parent
 * (`stage.ts`, page « méthode ») lisent tous les deux ce module : un seuil
 * n'existe qu'ici, et changer le programme change automatiquement ce qu'on en
 * dit.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX HORLOGES
 *
 * Un enfant qui commence la diversification à 7 mois ne peut pas recevoir
 * d'emblée ce qu'un enfant de 7 mois diversifié depuis trois mois reçoit. Mais
 * le décaler « de trois mois » serait pire : trois choses sont attachées à
 * l'âge civil, pas à l'ancienneté, et les retarder cause un préjudice
 * documenté.
 *
 *   · Les morceaux. L'ESPGHAN fixe les textures grumeleuses à 8-10 mois au
 *     plus tard. Au-delà de 9-10 mois, la cohorte ALSPAC retrouve à 7 ans une
 *     consommation moindre de fruits et légumes et plus de troubles
 *     alimentaires.
 *   · La fenêtre allergènes, 4-12 mois : retarder ne protège pas.
 *   · Le fer : les réserves natales sont épuisées vers 6 mois, et plus de 90 %
 *     des besoins doivent ensuite venir de l'alimentation solide.
 *
 * D'où deux tables et une intersection :
 *
 *   ÂGE       (`AGE_RULES`)    — plafond. Ce que l'enfant a le droit de recevoir.
 *   ANCIENNETÉ(`TENURE_RULES`) — rampe. Ce que son expérience lui permet d'absorber.
 *
 * Une catégorie n'est ouverte que si **les deux** tables l'ouvrent. Comme la
 * rampe se compte en jours quand la table d'âge se compte en mois, un
 * démarrage tardif rattrape en quelques semaines au lieu de rester en retard.
 *
 * Vérification de non-régression : pour un démarrage à 4 mois, la table d'âge
 * est partout la plus contraignante — le comportement historique est conservé.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * SOURCES
 *
 * Calendrier et ordre : guide du cabinet de pédiatrie de l'Aiguelongue, suivi
 * à la lettre — 7 légumes puis les fruits « 10 à 15 jours après », protéines
 * vers 5 mois ½, féculents et matière grasse à 6 mois, second repas diversifié
 * vers 8-9 mois. Complété par le PNNS 4 (2022) et l'ESPGHAN (2017).
 */

export type MomentType =
  "petit-dej" | "dejeuner" | "gouter" | "diner" | "autre";

/** Catégories que le générateur place dans un créneau. */
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
 * PLAFOND D'ÂGE — en mois d'âge projeté (corrigé si prématurité).
 * Aucune de ces bornes ne bouge quand la diversification commence tard.
 */
const AGE_RULES: Record<MomentType, AgeTier[]> = {
  // Le petit-déjeuner solide ferme la diversification : la famille prend le relais.
  "petit-dej": [{ minAge: 12, cats: ["féculent", "laitier"] }],
  dejeuner: [
    { minAge: 4, cats: ["légume"] },
    // 5,5 mois : le repas complet du guide — protéine, et fruit en dessert.
    { minAge: 5.5, cats: ["légume", "protéine", "fruit"] },
    { minAge: 6, cats: ["légume", "protéine", "féculent", "fruit"] },
  ],
  // Le guide ouvre les fruits « 10 à 15 jours » après le premier légume, pas à
  // un âge donné : la borne d'âge n'est ici qu'un plancher (on ne démarre pas
  // la diversification avant 4 mois, donc le fruit ne peut pas arriver avant
  // 4 mois et demi). C'est `TENURE_RULES` qui décide vraiment.
  gouter: [
    { minAge: 4.5, cats: ["fruit"] },
    { minAge: 6, cats: ["fruit", "laitier"] },
  ],
  // 8,5 mois : « 2 repas diversifiés vers 9 mois » (guide). Le seuil précédent
  // était 7 mois, en avance sur la source.
  diner: [{ minAge: 8.5, cats: ["légume", "féculent"] }],
  autre: [{ minAge: 6, cats: ["légume", "féculent"] }],
};

/**
 * RAMPE D'ANCIENNETÉ — en jours depuis le premier aliment solide.
 *
 * Ce que l'enfant sait faire, pas ce qu'il a le droit de manger. Se compte en
 * jours : l'OMS place 2 à 3 repas par jour dès 6-8 mois, un démarrage tardif
 * doit donc rejoindre son âge en semaines, pas en mois.
 */
const TENURE_RULES: Record<MomentType, TenureTier[]> = {
  "petit-dej": [{ minDay: 50, cats: ["féculent", "laitier"] }],
  dejeuner: [
    { minDay: 0, cats: ["légume"] },
    // J8 : la protéine. Plancher fer — un enfant qui démarre à 6 mois ou plus
    // ne peut pas rester six semaines sur des légumes seuls.
    { minDay: 8, cats: ["légume", "protéine"] },
    { minDay: 15, cats: ["légume", "protéine", "féculent", "fruit"] },
  ],
  // Les 7 légumes du guide, à raison de deux jours chacun, occupent exactement
  // quatorze jours ; le seuil est posé à J13 pour que le premier fruit tombe le
  // quinzième jour — « 10 à 15 jours après » le premier légume, dit le guide —
  // et non deux jours plus tard, une fois la répétition passée.
  gouter: [
    { minDay: 13, cats: ["fruit"] },
    { minDay: 22, cats: ["fruit", "laitier"] },
  ],
  diner: [{ minDay: 36, cats: ["légume", "féculent"] }],
  autre: [{ minDay: 36, cats: ["légume", "féculent"] }],
};

/** Âge (mois) à partir duquel une matière grasse est ajoutée aux repas salés. */
export const FAT_FROM_MONTHS = 6;

/**
 * Nombre de jours pendant lesquels la texture reste lisse quoi qu'il arrive.
 * Un enfant qui démarre à 9 mois n'a jamais mangé de purée : il lui faut
 * quelques jours de lisse — mais quelques jours seulement, l'ESPGHAN
 * déconseillant explicitement de prolonger le lisse.
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
 * Catégories ouvertes dans un créneau : l'intersection du plafond d'âge et de
 * la rampe d'ancienneté. Vide = le créneau reste au lait.
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

/** Âge (mois) plancher d'ouverture d'un moment — sert à expliquer, pas à générer. */
export function momentOpensAtMonths(label: string): number {
  const tiers = AGE_RULES[classifyMoment(label)];
  return Math.min(...tiers.map((t) => t.minAge));
}

/** Ancienneté (jours) plancher d'ouverture d'un moment. */
export function momentOpensAtDay(label: string): number {
  const tiers = TENURE_RULES[classifyMoment(label)];
  return Math.min(...tiers.map((t) => t.minDay));
}

/**
 * Texture conseillée. L'âge commande ; l'ancienneté ne peut que retenir le
 * lisse, et seulement les tout premiers jours.
 */
export function textureFor(ageMonths: number, tenureDays: number): string {
  if (tenureDays < SMOOTH_TEXTURE_DAYS) return "purée bien lisse";
  if (ageMonths < 8) return "purée bien lisse";
  if (ageMonths < 10) return "écrasé à la fourchette";
  return "petits morceaux fondants";
}

/**
 * Facteur de montée en quantité sur la première semaine : « 2 à 3 cuillères à
 * café, puis 50 à 60 g en une semaine » (guide). S'applique à l'ancienneté,
 * pas à l'âge — un enfant qui démarre à 8 mois commence lui aussi petit.
 */
export function portionRampFactor(tenureDays: number): number {
  if (tenureDays >= RAMP_UP_DAYS) return 1;
  return 0.35 + (0.65 * tenureDays) / RAMP_UP_DAYS;
}

/** Ancienneté (jours) à une date donnée. `startedOn` null = compte depuis `fallbackISO`. */
export function tenureDaysAt(
  dateISO: string,
  startedOnISO: string | null,
  fallbackISO: string,
): number {
  const from = new Date(`${startedOnISO ?? fallbackISO}T00:00:00`);
  const day = new Date(`${dateISO}T00:00:00`);
  return Math.floor((day.getTime() - from.getTime()) / 86_400_000);
}
