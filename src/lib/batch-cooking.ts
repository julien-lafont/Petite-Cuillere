/**
 * Quels aliments méritent vraiment d'être cuisinés en lot puis congelés.
 *
 * La répétition seule ne justifie rien : l'huile de colza revient à tous les
 * repas salés, le petit-suisse à presque tous les goûters, et proposer d'en
 * « congeler 10 portions » était un contresens — l'une se garde des mois dans
 * un placard, l'autre déphase au congélateur.
 *
 * On ne retient donc qu'un aliment qui coche les trois cases :
 *   1. il demande une vraie préparation (épluchage + cuisson) qu'on a intérêt à
 *      ne faire qu'une fois ;
 *   2. sa texture d'arrivée — purée, compote, viande mixée — supporte bien la
 *      congélation puis le réchauffage ;
 *   3. il ne se conserve pas déjà tout seul assez longtemps (placard, corbeille
 *      à fruits, ou simple pot de laitage au frais).
 *
 * D'où les absences volontaires : matières grasses et laitages (rien à cuire,
 * mauvaise tenue au froid), œuf dur (le blanc devient caoutchouteux), pomme de
 * terre (purée granuleuse et collante à la décongélation), aubergine (gorgée
 * d'eau, sa purée ressort détrempée), banane et fruits rouges (donnés crus, sans
 * lot à préparer), riz, pâtes, semoule, pain et pruneau (le placard fait déjà le
 * travail, la cuisson est courte ou inexistante).
 *
 * Liste volontairement close, comme `PANTRY` dans `shopping-quantity.ts` : pour
 * un aliment ajouté par un foyer, on ne connaît ni sa préparation ni sa tenue au
 * froid — mieux vaut se taire que conseiller à côté.
 */
const FREEZABLE = new Set([
  // Légumes : cuits vapeur puis mixés, ils se congèlent tous très bien.
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
  // La betterave s'achète cuite : rien à cuire en lot, mais la purée tient très
  // bien au congélateur et le mixage vaut d'être fait une fois pour toutes.
  "Betterave",
  // Fruits : seulement ceux qu'on donne en compote cuite.
  "Pomme",
  "Poire",
  "Abricot",
  "Pêche",
  // Protéines : cuites et mixées le jour même, congelées en portions de 10 g.
  // Un poisson acheté surgelé entre ici sans risque : c'est la cuisson qui
  // autorise la recongélation.
  "Poulet",
  "Bœuf",
  "Poisson blanc",
  "Poisson gras (sardine, maquereau)",
  // Féculents : ceux dont la cuisson est longue, ou la purée fait le voyage.
  "Patate douce",
  "Lentilles",
  "Pois chiches",
]);

/**
 * Vrai si l'aliment gagne à être préparé en lot puis congelé — la seule
 * condition pour lui proposer un conseil de congélation.
 */
export function isBatchFreezable(name: string): boolean {
  return FREEZABLE.has(name);
}
