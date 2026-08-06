/**
 * « Où en est l'enfant, et qu'est-ce qui change cette semaine » — LOGIQUE PURE.
 *
 * Raison d'être : le programme généré est une boîte noire pour le parent. Ce
 * module rend ses règles lisibles — quel créneau s'ouvre, quelle catégorie
 * entre au menu, quelle texture, quelles quantités — en lisant les *mêmes*
 * seuils que le générateur (`program/schedule.ts`, `portionFor`). Aucun seuil
 * n'est redéfini ici : si le générateur change, l'explication suit.
 *
 * Le stade est calé sur le **dimanche** de la semaine affichée : c'est l'état
 * de l'enfant à la fin de la semaine qui décrit le mieux ce qu'elle contient.
 * Les changements sont la différence entre le dimanche précédent et celui-ci.
 */
import { formatAge, resolveReferenceDate } from "@/lib/age";
import { addDays, toISODate } from "@/lib/dates";
import { ageMonthsDecimalAtDate } from "@/lib/food-eligibility";
import { portionFor } from "@/lib/portions";
import {
  FAT_FROM_MONTHS,
  slotCatsForLabel,
  tenureDaysAt,
  textureFor,
} from "@/lib/program/schedule";

export type WeekChangeKind =
  "moment" | "category" | "fat" | "texture" | "portion" | "allergen";

export type WeekChange = {
  kind: WeekChangeKind;
  /** Court, scannable — ex. « Les protéines entrent au menu ». */
  title: string;
  /** Une phrase : ce que fait le programme, et pourquoi. */
  detail: string;
};

export type ParentTip = { title: string; body: string };

export type WeekDiscovery = { name: string; isAllergen: boolean };

export type WeekBriefing = {
  /** Âge projeté au dimanche, ex. « 6 mois et 1 sem. ». */
  ageLabel: string;
  stageTitle: string;
  stageSummary: string;
  changes: WeekChange[];
  /** Renseigné uniquement quand rien ne change : on donne du contenu utile à la place. */
  tip: ParentTip | null;
  discoveries: WeekDiscovery[];
};

export type BuildBriefingInput = {
  babyName: string;
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
  /** Dimanche de la semaine affichée ('YYYY-MM-DD'). */
  sundayISO: string;
  /** Date du premier aliment solide — l'horloge de l'ancienneté. */
  diversificationStartedOn: string | null;
  /** Moments de repas du foyer, dans l'ordre. */
  momentLabels: string[];
  /** Aliments découverts dans la semaine (lundi → dimanche). */
  discoveries: WeekDiscovery[];
  /** Total d'aliments découverts jusqu'au dimanche inclus. */
  introducedTotal: number;
};

/**
 * Un stade est atteint quand l'enfant a l'âge **et** l'ancienneté requise. Le
 * décalage joue donc dans un seul sens : un démarrage tardif progresse plus
 * lentement les premières semaines, mais ne repousse jamais un palier lié à
 * l'âge (textures, morceaux).
 */
type Stage = { from: number; fromDay: number; title: string; summary: string };

/** Stades de diversification, calés sur les paliers de `program/schedule.ts`. */
const STAGES: Stage[] = [
  {
    from: 0,
    fromDay: -Infinity,
    title: "Avant la diversification",
    summary:
      "Tout passe encore par le lait. Le programme n'ouvre aucun repas solide avant 4 mois révolus.",
  },
  {
    from: 4,
    fromDay: 0,
    title: "Les premiers légumes",
    summary:
      "Un seul repas solide, le midi : un légume à la fois, en purée bien lisse, changé tous les deux jours. Le reste de la journée reste au lait.",
  },
  {
    from: 5.5,
    fromDay: 15,
    title: "Le repas complet du midi",
    summary:
      "Le midi devient un vrai repas — légume, protéine et fruit — et le goûter s'ouvre aux fruits, une quinzaine de jours après le premier légume.",
  },
  {
    from: 6,
    fromDay: 15,
    title: "Féculents et matière grasse",
    summary:
      "Le midi se complète d'un féculent — un tiers de féculent pour deux tiers de légumes — et chaque repas salé reçoit sa cuillère d'huile. Le lait reste la base : 500 à 750 mL par jour.",
  },
  {
    from: 8,
    fromDay: 15,
    title: "Les textures qui montent",
    summary:
      "Mêmes repas, mais on quitte le lisse : purées granuleuses et légumes écrasés à la fourchette, pour entraîner la mastication.",
  },
  {
    from: 8.5,
    fromDay: 36,
    title: "Deux repas solides",
    summary:
      "Le dîner s'ouvre à son tour, légume et féculent. Le midi reste le repas complet, avec l'unique portion de protéine de la journée.",
  },
  {
    from: 10,
    fromDay: 36,
    title: "Les morceaux",
    summary:
      "Petits morceaux fondants aux repas. C'est la fenêtre à ne pas manquer : au-delà, les morceaux deviennent nettement plus difficiles à faire accepter.",
  },
  {
    from: 12,
    fromDay: 50,
    title: "Vers les repas de la famille",
    summary:
      "Les quatre repas sont ouverts, petit-déjeuner compris. L'accompagnement s'arrête ici : la diversification est faite.",
  },
];

function stageAt(months: number, tenureDays: number): Stage {
  let current = STAGES[0];
  for (const s of STAGES) {
    if (months >= s.from && tenureDays >= s.fromDay) current = s;
  }
  return current;
}

/** Libellé indéfini d'une catégorie, ex. « une protéine ». */
const CAT_ONE: Record<string, string> = {
  légume: "un légume",
  fruit: "un fruit",
  protéine: "une protéine",
  féculent: "un féculent",
  laitier: "un laitage",
};

/** Libellé défini pluriel, ex. « les protéines ». */
const CAT_MANY: Record<string, string> = {
  légume: "les légumes",
  fruit: "les fruits",
  protéine: "les protéines",
  féculent: "les féculents",
  laitier: "les laitages",
};

/** Le « pourquoi » de chaque catégorie, d'après le guide PNNS 4. */
const CAT_WHY: Record<string, string> = {
  légume:
    "Un seul légume par jour, changé le lendemain : commencer par les légumes améliore durablement leur acceptation.",
  fruit:
    "Après les légumes, jamais avant : proposés en premier, les fruits rendent les légumes plus difficiles à faire passer.",
  protéine:
    "10 g par jour suffisent avant 1 an — 2 c. à café de viande ou de poisson, ou ¼ d'œuf dur — et dans un seul repas.",
  féculent:
    "Environ un quart de la portion de légumes : les glucides complexes couvrent 40 à 50 % des besoins en énergie.",
  laitier:
    "Un laitage nature, sans sucre ajouté : les fruits suffisent à le sucrer.",
};

function joinFr(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function crossed(threshold: number, before: number, after: number): boolean {
  return before < threshold && after >= threshold;
}

/** Hash stable d'une chaîne — pour choisir un conseil qui ne bouge pas dans la semaine. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type TipRule = ParentTip & { from?: number; to?: number };

/**
 * Conseils affichés les semaines sans changement. Règles d'écriture : un fait
 * vérifiable par conseil, actionnable, jamais une injonction ni un jugement sur
 * la façon de faire du parent — et rien qui puisse se lire comme un reproche.
 */
const TIPS: TipRule[] = [
  {
    title: "Un refus n'est pas un verdict",
    body: "Il faut parfois une dizaine de propositions pour qu'un aliment passe. Le représenter trois jours plus tard, cuisiné autrement, marche mieux qu'insister le jour même.",
  },
  {
    title: "Les surgelés valent le frais",
    body: "À la congélation, un légume garde ses qualités nutritionnelles — parfois mieux qu'un frais qui a attendu. Le sac de haricots verts au congélateur est un vrai plan de secours.",
  },
  {
    from: 4,
    title: "Ni sel ni sucre, pour une raison précise",
    body: "Ce n'est pas une privation : c'est maintenant que le palais se règle. Les herbes et les épices douces, elles, sont autorisées et font le même travail de variété.",
  },
  {
    from: 4,
    title: "C'est l'appétit qui commande",
    body: "Tête qui se détourne, bouche fermée : le repas est terminé, même si le pot ne l'est pas. Les quantités affichées servent à préparer la bonne dose, pas à être finies.",
  },
  {
    from: 4,
    to: 8,
    title: "Un goût par jour",
    body: "Un seul légume nouveau à la fois, puis un autre le lendemain. C'est la variété précoce, pas la répétition du même, qui limite les refus vers 2 ans.",
  },
  {
    from: 6,
    title: "Le lait reste la base",
    body: "500 à 750 mL par jour jusqu'à 3 ans, repas solides compris. Les purées s'ajoutent au lait, elles ne le remplacent pas encore.",
  },
  {
    from: 6,
    to: 12,
    title: "Un morceau à tenir dans la main",
    body: "Une croûte de pain ou un biscuit dur, sous surveillance, entraîne la mastication bien avant que les morceaux n'arrivent dans l'assiette.",
  },
  {
    from: 6,
    title: "L'eau, au verre, pendant le repas",
    body: "C'est la seule boisson utile. Environ 800 mL par jour à 1 an, aliments compris — le reste vient des purées et du lait.",
  },
  {
    from: 9,
    title: "Les fromages, sauf le lait cru",
    body: "Dès 9 mois, presque tous les fromages, à l'exception du lait cru. Le comté et le gruyère font exception : leur pâte pressée cuite est sûre.",
  },
  {
    from: 10,
    title: "Ce qui est rond se coupe",
    body: "Tomate cerise, raisin, olive : coupés en deux dans la longueur. Et rien de dur et cru — pomme, carotte — tant que les molaires ne sont pas là.",
  },
  {
    title: "Le miel attend le premier anniversaire",
    body: "Y compris cuit, dans un gâteau ou un yaourt : le botulisme infantile ne dépend pas de la cuisson.",
  },
];

function pickTip(
  ageMonths: number,
  sundayISO: string,
  babyName: string,
  introducedTotal: number,
): ParentTip {
  const pool: ParentTip[] = TIPS.filter(
    (t) => ageMonths >= (t.from ?? 0) && ageMonths < (t.to ?? Infinity),
  ).map(({ title, body }) => ({ title, body }));

  // Renforcement chiffré : disponible seulement quand le répertoire est déjà
  // constitué — sinon le compliment sonnerait creux.
  if (introducedTotal >= 8) {
    pool.push({
      title: `${introducedTotal} aliments déjà goûtés`,
      body: `Le répertoire de ${babyName} s'élargit d'une nouveauté tous les deux jours, chacune reproposée le lendemain. C'est exactement ce rythme-là qui construit l'acceptation sur le long terme.`,
    });
  }

  return pool[hash(sundayISO) % pool.length];
}

export function buildWeekBriefing(input: BuildBriefingInput): WeekBriefing {
  const {
    babyName,
    birthDate,
    dueDate,
    ageReferenceDate,
    sundayISO,
    diversificationStartedOn,
    momentLabels,
    discoveries,
    introducedTotal,
  } = input;

  const ageAt = (iso: string) =>
    ageMonthsDecimalAtDate(iso, birthDate, dueDate, ageReferenceDate);

  const previousSundayISO = toISODate(
    addDays(new Date(`${sundayISO}T00:00:00`), -7),
  );
  const now = ageAt(sundayISO);
  const before = ageAt(previousSundayISO);

  // Seconde horloge : l'ancienneté de diversification. Elle décide seule de
  // l'ouverture des créneaux tant que l'âge le permet — sans elle, un enfant
  // qui démarre à 7 mois recevrait d'emblée trois repas solides.
  const tenureNow = tenureDaysAt(
    sundayISO,
    diversificationStartedOn,
    sundayISO,
  );
  const tenureBefore = Math.max(0, tenureNow - 7);

  const stage = stageAt(now, tenureNow);
  const changes: WeekChange[] = [];

  // 1. Créneaux qui s'ouvrent aux solides cette semaine.
  for (const label of momentLabels) {
    // Un créneau peut s'ouvrir parce que l'enfant a grandi *ou* parce qu'il
    // mange depuis assez longtemps : on compare les deux états, pas un seuil.
    if (slotCatsForLabel(label, before, tenureBefore).length > 0) continue;
    const cats = slotCatsForLabel(label, now, tenureNow);
    if (cats.length === 0) continue;
    changes.push({
      kind: "moment",
      title: `${label} : premier repas solide`,
      detail: `Ce moment restait au lait jusqu'ici. Le programme y place désormais ${joinFr(
        cats.map((c) => CAT_ONE[c] ?? c),
      )}.`,
    });
  }

  // 2. Catégories qui entrent dans un créneau déjà ouvert.
  for (const label of momentLabels) {
    const catsBefore = slotCatsForLabel(label, before, tenureBefore);
    if (catsBefore.length === 0) continue; // créneau qui vient de s'ouvrir → déjà décrit
    const added = slotCatsForLabel(label, now, tenureNow).filter(
      (c) => !catsBefore.includes(c),
    );
    if (added.length === 0) continue;
    changes.push({
      kind: "category",
      title: `${capitalize(joinFr(added.map((c) => CAT_MANY[c] ?? c)))} au ${label.toLowerCase()}`,
      detail: added
        .map((c) => CAT_WHY[c])
        .filter(Boolean)
        .join(" "),
    });
  }

  // 3. Matière grasse quotidienne dans les repas salés.
  if (crossed(FAT_FROM_MONTHS, before, now)) {
    changes.push({
      kind: "fat",
      title: "Une cuillère d'huile dans chaque plat salé",
      detail:
        "Ajoutée crue, hors cuisson, de préférence colza ou noix. Avant 3 ans les lipides représentent environ 45 % des apports — c'est le manque, pas l'excès, qui est fréquent.",
    });
  }

  // 4. Texture.
  const textureBefore = textureFor(before, tenureBefore);
  const textureNow = textureFor(now, tenureNow);
  if (textureBefore !== textureNow) {
    changes.push({
      kind: "texture",
      title: `Nouvelle texture : ${textureNow}`,
      detail:
        now >= 10
          ? "Les morceaux mous se mâchent, ce qui prépare la suite. Les repousser au-delà de 10 mois se paie ensuite en refus et en répertoire plus étroit."
          : "Quelques grumeaux volontaires, ou des légumes écrasés à la fourchette : la bouche apprend à gérer autre chose que du lisse.",
    });
  }

  // 5. Quantités indicatives.
  const portionBefore = portionFor("légume", before).label;
  const portionNow = portionFor("légume", now).label;
  if (portionBefore !== portionNow) {
    changes.push({
      kind: "portion",
      title: `Les portions passent à ${portionNow}`,
      detail: `Repère de préparation pour les légumes et les fruits, pas un objectif : c'est ${babyName} qui décide de la fin du repas.`,
    });
  }

  // 6. Allergènes découverts cette semaine (donnée réelle du programme).
  const newAllergens = discoveries.filter((d) => d.isAllergen);
  if (newAllergens.length > 0) {
    changes.push({
      kind: "allergen",
      title:
        newAllergens.length === 1
          ? `Première fois avec ${newAllergens[0].name.toLowerCase()}`
          : `${newAllergens.length} allergènes découverts`,
      detail: `${capitalize(
        joinFr(newAllergens.map((a) => a.name.toLowerCase())),
      )} ${newAllergens.length === 1 ? "est proposé" : "sont proposés"} isolément, à trois jours d'intervalle au moins : c'est ce qui permet de rattacher une réaction au bon aliment. Les introduire tôt réduit le risque d'allergie.`,
    });
  }

  const referenceDate = resolveReferenceDate(
    new Date(birthDate),
    dueDate ? new Date(dueDate) : null,
    ageReferenceDate ? new Date(ageReferenceDate) : null,
  );

  return {
    ageLabel: formatAge(referenceDate, new Date(`${sundayISO}T00:00:00`)),
    stageTitle: stage.title,
    stageSummary: stage.summary,
    changes,
    tip:
      changes.length > 0
        ? null
        : pickTip(now, sundayISO, babyName, introducedTotal),
    discoveries,
  };
}
