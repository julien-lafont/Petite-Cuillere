/**
 * Which foods are actually worth batch-cooking and freezing.
 *
 * Repetition alone justifies nothing: rapeseed oil comes back at every savoury
 * meal, petit-suisse at nearly every snack, and offering to "freeze 10 portions"
 * of either made no sense — one keeps for months in a cupboard, the other splits
 * in the freezer.
 *
 * So a food only qualifies if it ticks all three boxes:
 *   1. it needs real preparation (peeling + cooking) worth doing once;
 *   2. the texture it ends up in — purée, compote, minced meat — takes freezing
 *      and reheating well;
 *   3. it does not already keep long enough on its own (cupboard, fruit bowl, or
 *      a pot of dairy in the fridge).
 *
 * Hence the deliberate absences: fats and dairy (nothing to cook, poor in the
 * cold), hard-boiled egg (the white turns rubbery), potato (grainy and gluey
 * purée once thawed), aubergine (waterlogged, its purée comes out soggy), banana
 * and berries (served raw, no batch to prepare), rice, pasta, semolina, bread and
 * prune (the cupboard already does the work, cooking is short or absent).
 *
 * Deliberately a closed list, like `PANTRY` in `shopping-quantity.ts`: for a food
 * a household added we know neither its preparation nor how it takes the cold —
 * better to say nothing than to advise wrong.
 */
const FREEZABLE = new Set([
  // Vegetables: steamed then blended, they all freeze very well.
  "Carotte",
  "Haricot vert",
  "Courgette",
  "Potiron",
  "Courge",
  "Épinard",
  "Blanc de poireau",
  "Brocoli",
  "Panais",
  "Petits pois",
  "Chou",
  "Navet",
  "Fenouil",
  "Tomate",
  "Poivron",
  // Beetroot is bought cooked: no batch to cook, but the purée holds up very
  // well in the freezer and blending is worth doing once for all.
  "Betterave",
  // Fruit: only the ones served as cooked compote.
  "Pomme",
  "Poire",
  "Abricot",
  "Pêche",
  // Proteins: cooked and blended the same day, frozen in 10 g portions.
  // Fish bought frozen belongs here safely: cooking is what allows refreezing.
  "Poulet",
  "Bœuf",
  "Poisson blanc",
  "Poisson gras (sardine, maquereau)",
  // Starches: the ones with a long cook, or whose purée travels well.
  "Patate douce",
  "Lentilles",
  "Pois chiches",
]);

/**
 * True when the food is worth cooking in a batch and freezing — the only
 * condition for offering a freezing tip.
 */
export function isBatchFreezable(name: string): boolean {
  return FREEZABLE.has(name);
}
