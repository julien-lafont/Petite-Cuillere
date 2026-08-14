/** Food categories — label, emoji, chart colour. Pure, client and server. */

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
  // "Féculents" long covered the three groups above together. The key stays —
  // the generator uses it as a slot name (`slotGroupOf`) — but what is left of
  // it in the catalogue is tubers, and that is what the parent should read.
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
 * TWO READINGS OF THE SAME CATEGORY
 *
 * What the parent reads and what the generator handles are not the same thing.
 * A parent shops by aisle: grains, pulses and tubers are three separate lists.
 * The generator only puts **one** starch in a lunch — it composes a meal by
 * walking the slot's open categories (`plan.ts`), and three starch categories
 * would have it serve rice, lentils *and* potato the same midday.
 *
 * Hence this fold: the catalogue's fine-grained category collapses to one of the
 * five groups the programme knows (`SLOT_CATEGORIES`, in `program/schedule.ts`).
 * NULL = this category never takes a place in a meal; those are the extras
 * served alongside — fats, nut butters, condiments.
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
 * The slot a food of this category takes, or NULL if it takes none. An unknown
 * category — a food entered outside the catalogue — is not planned: that is the
 * safest fallback, it makes nothing appear.
 */
export function slotGroupOf(cat: string | null): string | null {
  return SLOT_GROUP[(cat ?? "") as FoodCategory] ?? null;
}
