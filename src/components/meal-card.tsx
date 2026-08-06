import {
  AlertTriangle,
  Snowflake,
  Leaf,
  Snowflake as Freeze,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { freshnessAdvice } from "@/lib/season";
import { composeRecipe } from "@/lib/recipe";
import type { MealItem, MealWithDetails } from "@/lib/data/meals.types";

/**
 * Fiche recette d'un repas : quoi · combien · comment, dans cet ordre — c'est la
 * pièce maîtresse de l'écran « Aujourd'hui » (cf. docs/ux-redesign.md §5).
 *
 * Le parent n'a aucune décision à prendre : quantités calculées, pas-à-pas prêt,
 * garde-fous affichés là où l'erreur se commettrait.
 */
export function MealCard({
  momentLabel,
  meal,
  ageMonths,
  introducedIds,
  upcomingCounts,
}: {
  momentLabel: string;
  meal: MealWithDetails;
  /** Âge projeté en mois, pour les quantités et la texture. */
  ageMonths: number;
  introducedIds?: string[];
  /** Occurrences à venir par aliment (horizon mensuel), pour l'indice congélation. */
  upcomingCounts?: Record<string, number>;
}) {
  const month = Number(meal.date.slice(5, 7));
  const introducedSet = introducedIds ? new Set(introducedIds) : null;
  const recipe = composeRecipe(meal.meal_items, ageMonths);

  const foods = meal.meal_items
    .map((it) => it.food)
    .filter((f): f is NonNullable<MealItem["food"]> => f !== null);

  // Une nouveauté = un aliment jamais introduit. On la met en avant.
  const novelty = introducedSet
    ? foods.find((f) => !introducedSet.has(f.id))
    : undefined;

  // Indice batch cooking : l'aliment qui revient le plus dans le mois à venir.
  const repeated =
    upcomingCounts &&
    foods
      .map((f) => ({ f, n: upcomingCounts[f.id] ?? 0 }))
      .filter((x) => x.n >= 3)
      .sort((a, b) => b.n - a.n)[0];

  const restrictions = foods.filter((f) => f.restrictions);

  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-soft">
      <header className="flex items-center justify-between gap-2 px-5 pt-5">
        <h3 className="font-heading text-lg font-semibold">{momentLabel}</h3>
        {novelty && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-novelty px-2.5 py-1 text-xs font-semibold text-novelty-foreground">
            <span className="size-1.5 rounded-full bg-current" />
            nouveauté
          </span>
        )}
      </header>

      {/* Composition : chaque aliment + sa quantité */}
      <div className="px-5 pt-3">
        <ul className="space-y-1.5">
          {recipe.lines.map((line) => (
            <li
              key={line.id}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="font-heading text-base font-semibold">
                {line.name}
                {line.isAllergen && (
                  <span className="ml-2 align-middle text-xs font-medium text-novelty">
                    · allergène
                  </span>
                )}
              </span>
              {/* Une dose du protocole allergènes n'est pas un repère à
                  ajuster selon l'appétit : on la distingue de la portion. */}
              <span
                className={cn(
                  "shrink-0 text-sm font-medium tabular-nums",
                  line.isPrescribedDose
                    ? "text-right text-novelty"
                    : "text-muted-foreground",
                )}
              >
                {line.portion.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Pas-à-pas */}
      {recipe.steps.length > 0 && (
        <ol className="mt-4 space-y-2.5 border-t px-5 py-4">
          {recipe.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-base">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground tabular-nums">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-snug">{step.text}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Garde-fou permanent : jamais de sel ni de sucre */}
      <p className="mx-5 mb-1 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
        <span aria-hidden>ⓘ</span>
        Ni sel ni sucre ajoutés.
      </p>

      {/* Restrictions spécifiques (ex. miel avant 12 mois) */}
      {restrictions.map((f) => (
        <p
          key={f.id}
          className="mx-5 mb-1 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-medium">{f.name}</span> — {f.restrictions}
          </span>
        </p>
      ))}

      {/* Saisonnalité — utile au moment de cuisiner/acheter */}
      {foods.map((f) => {
        const advice = f.season ? freshnessAdvice(f.season, month) : null;
        if (advice === "frais") {
          return (
            <p
              key={f.id}
              className="mx-5 mb-1 flex items-center gap-2 px-3 py-1 text-sm text-primary"
            >
              <Leaf className="size-4" />
              {f.name} de saison — profites-en frais.
            </p>
          );
        }
        if (advice === "surgele") {
          return (
            <p
              key={f.id}
              className="mx-5 mb-1 flex items-center gap-2 px-3 py-1 text-sm text-muted-foreground"
            >
              <Snowflake className="size-4" />
              {f.name} hors saison — le surgelé fait très bien l'affaire.
            </p>
          );
        }
        return null;
      })}

      {/* Indice batch cooking, à horizon mensuel */}
      {repeated && (
        <div className="mx-5 mb-5 mt-2 flex items-start gap-2.5 rounded-md bg-accent px-3.5 py-3 text-sm text-accent-foreground">
          <Freeze className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">
              {repeated.f.name} revient {repeated.n} fois
            </span>{" "}
            dans les semaines à venir. Prépares-en plus aujourd'hui et congèle{" "}
            {repeated.n - 1} portions — tout sera prêt d'avance.
          </p>
        </div>
      )}

      {/* Note libre saisie lors de l'évaluation */}
      {meal.note && (
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          📝 {meal.note}
        </p>
      )}
    </article>
  );
}
