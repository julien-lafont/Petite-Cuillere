import { Snowflake as Freeze } from "lucide-react";
import { cn } from "@/lib/utils";
import { capitalize, composeRecipe, type RecipeStep } from "@/lib/recipe";
import { MealComposition } from "@/components/meal-composition";
import type { MealItem, MealWithDetails } from "@/lib/data/meals.types";
import type { FoodRow } from "@/lib/data/foods";

/** Une suite d'étapes numérotée. Chaque préparation repart de 1 : ce sont deux
 *  recettes indépendantes, pas un seul enchaînement. */
function Steps({ steps }: { steps: RecipeStep[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground tabular-nums">
            {i + 1}
          </span>
          <span className="pt-0.5 leading-snug">{step.text}</span>
        </li>
      ))}
    </ol>
  );
}

/** Intitulé de colonne / de bloc, en petites capitales discrètes. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h4>
  );
}

/**
 * La fiche d'un repas : **une seule carte**, et tout ce qui concerne ce repas
 * dedans — ce qu'il y a dans l'assiette, comment le préparer, et comment ça
 * s'est passé (`footer`).
 *
 * Le bloc de notation vivait dans une carte séparée, sous celle-ci : deux
 * cartes, donc deux sujets — alors qu'on note précisément le repas qui est
 * au-dessus. Il est désormais le pied de cette carte, derrière un simple trait.
 *
 * ── Sur grand écran ────────────────────────────────────────────────────────
 * Deux colonnes à partir de `lg` : la composition à gauche, le pas-à-pas à
 * droite. Une carte pleine largeur étirait chaque ligne sur 700 px pour trois
 * mots, et repoussait les quantités hors du champ de lecture.
 *
 * Les conseils (saison, restriction) ne forment plus de pavé en bas de fiche :
 * ils sont posés sur la ligne de l'aliment concerné (`MealComposition`).
 */
export function MealCard({
  momentLabel,
  meal,
  ageMonths,
  introducedIds,
  upcomingCounts,
  substitution,
  footer,
}: {
  momentLabel: string;
  meal: MealWithDetails;
  /** Âge projeté en mois, pour les quantités et la texture. */
  ageMonths: number;
  introducedIds?: string[];
  /** Occurrences à venir par aliment (horizon mensuel), pour l'indice congélation. */
  upcomingCounts?: Record<string, number>;
  /**
   * Active « Remplacer » sur chaque aliment. Absent = fiche en lecture seule
   * (aperçu sans compte, jours à venir repliés).
   */
  substitution?: { babyId: string; foods: FoodRow[] };
  /** Le compte rendu du repas — rendu en pied de carte, pas dans une autre. */
  footer?: React.ReactNode;
}) {
  const month = Number(meal.date.slice(5, 7));
  const introducedSet = introducedIds ? new Set(introducedIds) : null;
  const recipe = composeRecipe(meal.meal_items, ageMonths);
  const hasSteps =
    recipe.parts.some((p) => p.steps.length > 0) ||
    recipe.extraSteps.length > 0;
  const titled = recipe.parts.length > 1;

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

  return (
    <article className="overflow-hidden rounded-lg border bg-card shadow-soft">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h3 className="font-heading text-lg font-semibold">{momentLabel}</h3>
        {novelty && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-novelty px-2.5 py-1 text-xs font-semibold text-novelty-foreground">
            <span className="size-1.5 rounded-full bg-current" />
            nouveauté
          </span>
        )}
      </header>

      <div
        className={cn(
          hasSteps &&
            "lg:grid lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]",
        )}
      >
        <section className={cn("px-5 py-4", hasSteps && "lg:border-r")}>
          <Kicker>Dans l'assiette</Kicker>
          <MealComposition
            lines={recipe.lines}
            month={month}
            substitution={
              substitution && meal.meal_moment_id
                ? {
                    babyId: substitution.babyId,
                    date: meal.date,
                    momentId: meal.meal_moment_id,
                    foods: substitution.foods,
                    introducedIds: introducedIds ?? [],
                    ageMonths,
                    usage: upcomingCounts,
                  }
                : undefined
            }
          />
        </section>

        {/* Pas-à-pas, une liste par préparation. Le titre n'apparaît que s'il y
            a bien deux choses à distinguer — un goûter d'une seule compote n'a
            rien à titrer. */}
        {hasSteps && (
          <section className="border-t px-5 py-4 lg:border-t-0">
            <Kicker>Préparation</Kicker>
            <div className="space-y-4">
              {recipe.parts.map((part) => (
                <div key={part.course}>
                  {titled && (
                    <p className="mb-2 font-heading text-sm font-semibold">
                      {capitalize(part.name)}
                    </p>
                  )}
                  <Steps steps={part.steps} />
                </div>
              ))}
              {recipe.extraSteps.length > 0 && (
                <Steps steps={recipe.extraSteps} />
              )}
              {recipe.serving && (
                <p className="rounded-md bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
                  {recipe.serving}
                </p>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Indice batch cooking, à horizon mensuel */}
      {repeated && (
        <p className="flex items-start gap-2.5 border-t bg-accent px-5 py-3 text-sm text-accent-foreground">
          <Freeze className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">
              {repeated.f.name} revient {repeated.n} fois
            </span>{" "}
            dans les semaines à venir. Prépares-en plus aujourd'hui et congèle{" "}
            {repeated.n - 1} portions — tout sera prêt d'avance.
          </span>
        </p>
      )}

      {/* Note libre saisie lors de l'évaluation */}
      {meal.note && (
        <p className="border-t px-5 py-3 text-sm text-muted-foreground">
          📝 {meal.note}
        </p>
      )}

      {footer && <div className="border-t bg-muted/40 px-5 py-4">{footer}</div>}
    </article>
  );
}
