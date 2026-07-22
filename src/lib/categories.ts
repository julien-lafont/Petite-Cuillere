/** Catégories d'aliments — libellé, emoji, couleur de graphique. Pur, client/serveur. */

export type FoodCategory =
  | "légume"
  | "fruit"
  | "protéine"
  | "laitier"
  | "féculent"
  | "matière grasse"
  | "autre";

export const CATEGORY_META: Record<
  FoodCategory,
  { label: string; emoji: string; chartVar: string }
> = {
  légume: { label: "Légumes", emoji: "🥕", chartVar: "var(--chart-1)" },
  fruit: { label: "Fruits", emoji: "🍎", chartVar: "var(--chart-5)" },
  protéine: { label: "Protéines", emoji: "🍗", chartVar: "var(--chart-2)" },
  laitier: { label: "Produits laitiers", emoji: "🧀", chartVar: "var(--chart-3)" },
  féculent: { label: "Féculents", emoji: "🌾", chartVar: "var(--chart-4)" },
  "matière grasse": {
    label: "Matières grasses",
    emoji: "🫒",
    chartVar: "var(--muted-foreground)",
  },
  autre: { label: "Autres", emoji: "🥄", chartVar: "var(--secondary-foreground)" },
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
