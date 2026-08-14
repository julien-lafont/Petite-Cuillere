/**
 * "Where the child is at, and what changes this week" — PURE LOGIC.
 *
 * Why it exists: the generated programme is a black box to the parent. This
 * module makes its rules readable — which slot opens, which category joins the
 * menu, which texture, which quantities — by reading the *same* thresholds as
 * the generator (`program/schedule.ts`, `portionFor`). No threshold is redefined
 * here: if the generator changes, the explanation follows.
 *
 * The stage is pinned to the **Sunday** of the week shown: the child's state at
 * the end of the week is what best describes what the week holds. Changes are
 * the difference between the previous Sunday and this one.
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
  | "moment"
  | "category"
  | "fat"
  | "texture"
  | "portion"
  | "allergen"
  /** Resuming after a long break — the ramp restarts where it stopped. */
  | "reprise";

export type WeekChange = {
  kind: WeekChangeKind;
  /** Court, scannable — ex. « Les protéines entrent au menu ». */
  title: string;
  /** One sentence: what the programme does, and why. */
  detail: string;
};

export type ParentTip = { title: string; body: string };

export type WeekDiscovery = { name: string; isAllergen: boolean };

export type WeekBriefing = {
  /** Projected age on the Sunday, e.g. "6 mois et 1 sem.". */
  ageLabel: string;
  stageTitle: string;
  stageSummary: string;
  changes: WeekChange[];
  /** Only set when nothing changes: we give useful content instead. */
  tip: ParentTip | null;
  discoveries: WeekDiscovery[];
};

export type BuildBriefingInput = {
  babyName: string;
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
  /** Sunday of the week shown ('YYYY-MM-DD'). */
  sundayISO: string;
  /** Date of the first solid food — the clock for elapsed time. */
  diversificationStartedOn: string | null;
  /** The household's meal moments, in order. */
  momentLabels: string[];
  /** Foods discovered during the week (Monday → Sunday). */
  discoveries: WeekDiscovery[];
  /** Total foods discovered up to and including the Sunday. */
  introducedTotal: number;
  /**
   * Days of interruption to subtract from the elapsed time (R11). A child who
   * ate no solids for three weeks is not three weeks more experienced — but
   * their age has moved on all the same.
   */
  interruptionDays?: number;
};

/**
 * A stage is reached when the child has both the age **and** the elapsed time.
 * The offset therefore only cuts one way: a late start progresses more slowly in
 * the first weeks, but never pushes back an age-bound step (textures, lumps).
 */
type Stage = { from: number; fromDay: number; title: string; summary: string };

/** Diversification stages, aligned with the steps in `program/schedule.ts`. */
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

/** Indefinite label for a category, e.g. "une protéine". */
const CAT_ONE: Record<string, string> = {
  légume: "un légume",
  fruit: "un fruit",
  protéine: "une protéine",
  féculent: "un féculent",
  laitier: "un laitage",
};

/** Definite plural label, e.g. "les protéines". */
const CAT_MANY: Record<string, string> = {
  légume: "les légumes",
  fruit: "les fruits",
  protéine: "les protéines",
  féculent: "les féculents",
  laitier: "les laitages",
};

/** The "why" of each category, from the PNNS 4 guide. */
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

/** Stable hash of a string — to pick a tip that stays put through the week. */
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

type TipRule = ParentTip & { from?: number; to?: number };

/**
 * Tips shown on weeks with no change. Writing rules: one verifiable fact per
 * tip, actionable, never an order nor a judgement on how the parent does things
 * — and nothing that could read as a reproach.
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

  // Backed by a number: only available once the repertoire is built — the
  // compliment would ring hollow otherwise.
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
    interruptionDays = 0,
  } = input;

  const ageAt = (iso: string) =>
    ageMonthsDecimalAtDate(iso, birthDate, dueDate, ageReferenceDate);

  const previousSundayISO = toISODate(
    addDays(new Date(`${sundayISO}T00:00:00`), -7),
  );
  const now = ageAt(sundayISO);
  const before = ageAt(previousSundayISO);

  // Second clock: how long diversification has been going. It alone opens slots
  // while the age allows — without it, a child starting at 7 months would get
  // three solid meals straight away.
  //
  // A long break freezes it: otherwise coming back from holiday would find a
  // programme that moved on without the child. The age ceiling keeps running
  // though — iron and the allergen window do not wait.
  const tenureNow = Math.max(
    0,
    tenureDaysAt(sundayISO, diversificationStartedOn, sundayISO) -
      interruptionDays,
  );
  const tenureBefore = Math.max(0, tenureNow - 7);

  const stage = stageAt(now, tenureNow);
  const changes: WeekChange[] = [];

  // 0. Coming back after a break. Said before anything else, because it is what
  //    the parent has in mind when reopening the app — and because the tone must
  //    lift the guilt, not install it.
  if (interruptionDays > 0) {
    changes.push({
      kind: "reprise",
      title: "On reprend où vous vous étiez arrêtés",
      detail: `Après une pause, ${babyName} retrouve le programme là où il en était — pas là où il aurait été. Les quantités et les textures repartent en douceur.`,
    });
  }

  // 1. Slots opening to solids this week.
  for (const label of momentLabels) {
    // A slot can open because the child has grown *or* because they have been
    // eating long enough: we compare the two states, not a threshold.
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

  // 2. Categories entering an already-open slot.
  for (const label of momentLabels) {
    const catsBefore = slotCatsForLabel(label, before, tenureBefore);
    if (catsBefore.length === 0) continue; // slot that just opened → already described
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

  // 3. Daily fat in savoury meals.
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

  // 5. Indicative quantities.
  const portionBefore = portionFor("légume", before).label;
  const portionNow = portionFor("légume", now).label;
  if (portionBefore !== portionNow) {
    changes.push({
      kind: "portion",
      title: `Les portions passent à ${portionNow}`,
      detail: `Repère de préparation pour les légumes et les fruits, pas un objectif : c'est ${babyName} qui décide de la fin du repas.`,
    });
  }

  // 6. Allergens discovered this week (real programme data).
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
