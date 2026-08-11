/** Catégories d'aliments — libellé, emoji, couleur de graphique. Pur, client/serveur. */

export type FoodCategory =
  | "légume"
  | "fruit"
  | "protéine"
  | "laitier"
  | "céréale"
  | "légumineuse"
  | "féculent"
  | "matière grasse"
  | "oléagineux"
  | "condiment"
  | "autre";

export const CATEGORY_META: Record<
  FoodCategory,
  { label: string; emoji: string; chartVar: string }
> = {
  légume: { label: "Légumes", emoji: "🥕", chartVar: "var(--chart-1)" },
  fruit: { label: "Fruits", emoji: "🍎", chartVar: "var(--chart-5)" },
  protéine: { label: "Protéines", emoji: "🍗", chartVar: "var(--chart-2)" },
  laitier: {
    label: "Produits laitiers",
    emoji: "🧀",
    chartVar: "var(--chart-3)",
  },
  céréale: { label: "Céréales", emoji: "🌾", chartVar: "var(--chart-4)" },
  légumineuse: {
    label: "Légumineuses",
    emoji: "🫘",
    chartVar: "var(--chart-6)",
  },
  // « Féculents » a longtemps désigné les trois groupes ci-dessus réunis. La
  // clé ne bouge pas — c'est elle que le générateur emploie comme nom de
  // créneau (`slotGroupOf`) — mais ce qu'il en reste au catalogue, ce sont les
  // tubercules, et c'est ce que le parent doit lire.
  féculent: { label: "Tubercules", emoji: "🥔", chartVar: "var(--chart-7)" },
  "matière grasse": {
    label: "Matières grasses",
    emoji: "🫒",
    chartVar: "var(--muted-foreground)",
  },
  oléagineux: {
    label: "Purées d'oléagineux",
    emoji: "🥜",
    chartVar: "var(--chart-8)",
  },
  condiment: {
    label: "Condiments et aromates",
    emoji: "🌿",
    chartVar: "var(--secondary-foreground)",
  },
  autre: {
    label: "Autres",
    emoji: "🥄",
    chartVar: "var(--muted-foreground)",
  },
};

export const CATEGORY_ORDER = Object.keys(CATEGORY_META) as FoodCategory[];

export function categoryMeta(cat: string | null) {
  return (
    CATEGORY_META[(cat ?? "autre") as FoodCategory] ?? {
      label: cat ?? "Autre",
      emoji: "🥄",
      chartVar: "var(--muted-foreground)",
    }
  );
}

/**
 * ────────────────────────────────────────────────────────────────────────────
 * DEUX LECTURES D'UNE MÊME CATÉGORIE
 *
 * Ce que le parent lit et ce que le générateur manipule ne sont pas la même
 * chose. Le parent range ses courses par rayon : céréales, légumineuses,
 * tubercules sont trois listes distinctes. Le générateur, lui, ne pose qu'**un**
 * féculent dans un déjeuner — il compose un repas en parcourant les catégories
 * ouvertes du créneau (`plan.ts`), et trois catégories féculentes lui feraient
 * servir riz, lentilles *et* pomme de terre le même midi.
 *
 * D'où ce repli : la catégorie fine du catalogue se ramène à l'un des cinq
 * groupes que le programme connaît (`SLOT_CATEGORIES`, dans `program/schedule.ts`).
 * NULL = cette catégorie ne prend jamais de place dans un repas ; ce sont les
 * doses posées à côté — matière grasse, purées d'oléagineux, condiments.
 */
const SLOT_GROUP: Record<FoodCategory, string | null> = {
  légume: "légume",
  fruit: "fruit",
  protéine: "protéine",
  laitier: "laitier",
  céréale: "féculent",
  légumineuse: "féculent",
  féculent: "féculent",
  "matière grasse": null,
  oléagineux: null,
  condiment: null,
  autre: null,
};

/**
 * Le créneau qu'occupe un aliment de cette catégorie, ou NULL s'il n'en occupe
 * aucun. Une catégorie inconnue — un aliment saisi hors du catalogue — ne se
 * planifie pas : c'est le repli le plus sûr, il ne fait rien apparaître.
 */
export function slotGroupOf(cat: string | null): string | null {
  return SLOT_GROUP[(cat ?? "") as FoodCategory] ?? null;
}
