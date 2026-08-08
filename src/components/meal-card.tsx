import { Fragment } from "react";
import { Snowflake as Freeze } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  capitalize,
  composeRecipe,
  menuGlance,
  type RecipeStep,
} from "@/lib/recipe";
import { MealComposition } from "@/components/meal-composition";
import type { MealItem, MealWithDetails } from "@/lib/data/meals.types";
import type { FoodRow } from "@/lib/data/foods";

/**
 * Une suite d'étapes numérotée. Chaque préparation repart de 1 : ce sont deux
 * recettes indépendantes, pas un seul enchaînement.
 *
 * Le corps de l'étape est en gris et l'aliment concerné en tête, en foncé : de
 * loin, on suit la colonne des ingrédients ; de près, on lit le geste.
 */
function Steps({ steps }: { steps: RecipeStep[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3 text-muted-foreground">
          <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground tabular-nums">
            {i + 1}
          </span>
          <span className="leading-snug">
            {step.lead && (
              <span className="font-semibold text-foreground">
                {`${step.lead} : `}
              </span>
            )}
            {step.text}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Intitulé de colonne / de bloc, en petites capitales discrètes. */
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mb-3.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
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
 * Deux colonnes à partir de `lg` : **le pas-à-pas à gauche**, la composition à
 * droite. Une carte pleine largeur étirait chaque ligne sur 700 px pour trois
 * mots, et repoussait les quantités hors du champ de lecture.
 *
 * La préparation passe devant parce que c'est elle qu'on suit, casserole en
 * main, du début à la fin du repas ; la composition se consulte, elle, par
 * coups d'œil.
 *
 * Le partage est 55/45 et non 1fr + colonne fixe : les lignes d'aliment portent
 * un nom, une quantité, deux ou trois pastilles et le bouton « Remplacer » —
 * trop étroite, cette colonne repassait à la ligne alors que celle de gauche
 * gardait de l'air.
 *
 * ── Sur mobile ─────────────────────────────────────────────────────────────
 * L'ordre s'inverse : **la composition d'abord**, le pas-à-pas ensuite. On
 * regarde ce qu'il faut sortir du frigo avant de commencer à cuisiner, et
 * c'est là que se trouve « Remplacer » — le geste qui sert quand il manque
 * quelque chose, donc avant la première étape, pas après la dernière.
 *
 * D'où l'ordre du DOM : la composition en premier, puis les colonnes remises
 * en place à partir de `lg` par `col-start` / `row-start`. Faire l'inverse
 * (`order` sur la version mobile) aurait mis le contenu dans un ordre que ni
 * la lecture au clavier ni un lecteur d'écran ne suivent.
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
  const glance = menuGlance(recipe);
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
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5 border-b px-5 py-4">
        <h3 className="flex items-center gap-2.5 font-heading text-lg font-semibold">
          {momentLabel}
          {novelty && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-novelty-soft px-2.5 py-1 text-xs font-bold text-novelty">
              <span className="size-1.5 rounded-full bg-current" />
              nouveauté
            </span>
          )}
        </h3>
        {glance.dishes.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {"Au menu : "}
            {glance.dishes.map((dish, i) => (
              <Fragment key={i}>
                {i > 0 && ", puis "}
                <span className="font-semibold text-foreground">{dish}</span>
              </Fragment>
            ))}
            {glance.sides.length > 0 && (
              <>
                {", et "}
                <span className="font-semibold text-foreground">
                  {glance.sides.join(" & ").toLowerCase()}
                </span>
                {" à côté"}
              </>
            )}
            .
          </p>
        )}
      </header>

      <div
        className={cn(
          hasSteps && "lg:grid lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)]",
        )}
      >
        <section
          className={cn(
            "px-5 py-4",
            hasSteps && "bg-card-inset lg:col-start-2 lg:row-start-1",
          )}
        >
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
          <section className="border-t px-5 py-4 lg:col-start-1 lg:row-start-1 lg:border-r lg:border-t-0">
            <Kicker>Préparation</Kicker>
            <div className="space-y-5">
              {recipe.parts.map((part) => (
                <div key={part.course}>
                  {titled && (
                    <p className="mb-2.5 flex items-center gap-2.5 font-heading text-base font-semibold after:h-px after:flex-1 after:bg-border after:content-['']">
                      {capitalize(part.name)}
                    </p>
                  )}
                  <Steps steps={part.steps} />
                </div>
              ))}
              {recipe.extraSteps.length > 0 && (
                <Steps steps={recipe.extraSteps} />
              )}
            </div>
          </section>
        )}
      </div>

      {/* Indice batch cooking, à horizon mensuel. Un conseil, pas une alerte :
          il porte donc le vert des conseils, et non l'abricot de la vigilance. */}
      {repeated && (
        <p className="flex items-start gap-3 border-t bg-secondary px-5 py-4 text-sm text-secondary-foreground">
          <Freeze className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-bold">
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

      {footer && <div className="border-t px-5 py-4">{footer}</div>}
    </article>
  );
}
