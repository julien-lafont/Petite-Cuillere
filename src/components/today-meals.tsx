"use client";

import { useState } from "react";
import { MealCard, NoveltyPill } from "@/components/meal-card";
import { MealActions } from "@/components/meal-actions";
import { MealSummaryRow } from "@/components/meal-summary-row";
import { MealRealitySheet } from "@/components/meal-reality-sheet";
import { AllergenExposureBanner } from "@/components/allergen-exposure-banner";
import { capitalize, composeRecipe, menuGlance } from "@/lib/recipe";
import { currentMoment, nextMoment, phaseOf, windowLabel } from "@/lib/moments";
import {
  indexMeals,
  mealKey,
  type MealWithDetails,
} from "@/lib/data/meals.types";
import type { MealMoment } from "@/lib/data/meal-moments";
import type { FoodRow } from "@/lib/data/foods";

/**
 * Le menu en une ligne, pour la version repliée d'un repas — « purée de
 * courgette & œuf dur, puis compote de pêche ». Assez pour reconnaître le
 * repas, jamais assez pour croire qu'on lit encore la recette.
 */
function summarize(meal: MealWithDetails, ageMonths: number): string {
  const glance = menuGlance(composeRecipe(meal.meal_items, ageMonths));
  const dishes = glance.dishes.join(", puis ");
  const sides = glance.sides.join(" & ").toLowerCase();

  if (dishes && sides) return capitalize(`${dishes}, et ${sides} à côté`);
  if (dishes) return capitalize(dishes);
  if (sides) return capitalize(sides);

  // Aucune préparation à annoncer (que des aliments servis tels quels) : les
  // noms bruts font l'affaire, mieux vaut ça qu'une ligne vide.
  return meal.meal_items
    .map((it) => it.food?.name)
    .filter(Boolean)
    .join(", ");
}

/**
 * La journée de l'enfant, en un fil.
 *
 * ── Pourquoi un fil, et non une pile de fiches ──────────────────────────────
 * Une fiche repas est un document de cuisine : composition, quantités,
 * pas-à-pas, remplacements. On la lit **avant** le repas, et on renseigne
 * **après**. Empilées, quatre fiches dépliées faisaient plusieurs hauteurs
 * d'écran, la recette du midi tenait encore toute sa place à 20 h, et le geste
 * de compte rendu — le seul qui restait à faire — était enterré tout en bas de
 * chacune d'elles.
 *
 * D'où trois règles, et rien d'autre à retenir :
 *
 *   1. le curseur va au **repas de l'heure qu'il est** : celui dont le créneau
 *      est en cours, sinon le prochain à venir. C'est la seule fiche dépliée ;
 *   2. un repas renseigné **se replie**, sa recette avec lui, sur une ligne
 *      qui dit son état (`MealSummaryRow`). Un tap la rouvre ;
 *   3. un repas à venir est une ligne consultable — on prépare bien le dîner à
 *      15 h — mais l'ouvrir ne le rend pas validable d'un doigt distrait : il
 *      faut le demander.
 *
 * ── Le curseur suivait le remplissage, il suit l'horloge ────────────────────
 * Il allait au « premier repas dont le parent n'a rien dit ». Un petit-déjeuner
 * oublié le retenait donc toute la journée : à 19 h, la fiche dépliée était
 * celle du matin, et le dîner — le seul repas que le parent venait chercher —
 * se trouvait replié trois lignes plus bas. Le repas oublié n'est pas perdu
 * pour autant : c'est la bande de rattrapage qui le réclame, en haut de l'écran
 * (docs/feats/creneaux-horaires.md §6.1).
 *
 * L'appréciation ne vit plus dans la fiche : elle est proposée après coup, sur
 * la ligne repliée, et reste facultative.
 */
export function TodayMeals({
  babyId,
  date,
  dateLabel,
  nowMinutes,
  moments,
  meals,
  ageMonths,
  introducedIds,
  upcomingCounts,
  foods,
  birthDate,
  dueDate,
  ageReferenceDate,
}: {
  babyId: string;
  date: string;
  dateLabel: string;
  /** Minutes depuis minuit, dans le fuseau du foyer — l'heure qu'il est. */
  nowMinutes: number;
  moments: MealMoment[];
  meals: MealWithDetails[];
  ageMonths: number;
  introducedIds?: string[];
  upcomingCounts?: Record<string, number>;
  /** Catalogue, pour la feuille « le menu a changé ». */
  foods: FoodRow[];
  birthDate: string;
  dueDate: string | null;
  ageReferenceDate: string | null;
}) {
  // Le repas que le parent a ouvert de sa main. Null = c'est le curseur qui
  // commande, ce qui est le cas neuf fois sur dix.
  const [openId, setOpenId] = useState<string | null>(null);
  // Les repas à venir dont le parent a demandé la barre d'action.
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [realityMomentId, setRealityMomentId] = useState<string | null>(null);

  const index = indexMeals(meals);
  const introducedSet = introducedIds ? new Set(introducedIds) : null;

  const visible = moments.filter(
    (m) => (index.get(mealKey(date, m.id))?.meal_items.length ?? 0) > 0,
  );

  const realityMoment = moments.find((m) => m.id === realityMomentId) ?? null;
  const realityMeal = realityMomentId
    ? (index.get(mealKey(date, realityMomentId)) ?? null)
    : null;

  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-5 text-center text-muted-foreground">
        Rien de prévu aujourd'hui. Composez la semaine depuis l'onglet{" "}
        <span className="font-medium text-foreground">Ma semaine</span>.
      </p>
    );
  }

  // L'heure commande : le créneau en cours, sinon le prochain, sinon le dernier
  // repas de la journée (il est 23 h, il ne reste rien devant).
  const cursor =
    currentMoment(visible, nowMinutes) ??
    nextMoment(visible, nowMinutes) ??
    visible[visible.length - 1] ??
    null;
  const expandedId = openId ?? cursor?.id ?? null;

  /** Le repas vient d'être renseigné : le fil reprend la main. */
  function settle(momentId: string) {
    setOpenId(null);
    setRevealed((prev) => {
      if (!prev.has(momentId)) return prev;
      const next = new Set(prev);
      next.delete(momentId);
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {visible.map((moment) => {
        const meal = index.get(mealKey(date, moment.id))!;
        const foodsOfMeal = meal.meal_items.map((it) => it.food);

        // Découverte du jour : sert la pastille, et le message qui suit un refus
        // (« il faut souvent huit à dix essais »).
        const novelty = introducedSet
          ? foodsOfMeal.find((f) => f && !introducedSet.has(f.id))
          : null;

        if (moment.id !== expandedId) {
          return (
            <MealSummaryRow
              key={moment.id}
              babyId={babyId}
              date={date}
              momentId={moment.id}
              momentLabel={moment.label}
              summary={summarize(meal, ageMonths)}
              status={meal.status}
              result={meal.result}
              window={windowLabel(moment)}
              phase={phaseOf(moment, nowMinutes)}
              noveltyName={novelty?.name ?? null}
              badge={
                novelty && meal.status === "prevu" ? <NoveltyPill /> : undefined
              }
              onOpen={() => setOpenId(moment.id)}
            />
          );
        }

        // Bandeau d'introduction d'allergène : le seul cas où l'écran change de
        // registre (cf. docs/ux-redesign.md §5). Il vit dans la fiche du repas
        // concerné, pas au-dessus d'elle.
        const allergenItem = meal.meal_items.find(
          (it) =>
            it.food?.is_allergen &&
            (!introducedSet || !introducedSet.has(it.food.id)),
        );

        // Un repas à venir ouvert à la main ne montre pas de bouton vert : on
        // consulte sa recette pour cuisiner d'avance, on ne le clôt pas par
        // inadvertance à 15 h. C'est l'heure qui le dit, et non plus la
        // différence avec le curseur : un repas passé resté sans réponse est
        // directement renseignable, c'est le geste qu'on attend de lui.
        const ahead =
          meal.status === "prevu" && phaseOf(moment, nowMinutes) === "future";
        const armed = !ahead || revealed.has(moment.id);

        return (
          <MealCard
            key={moment.id}
            momentLabel={moment.label}
            momentWindow={windowLabel(moment)}
            meal={meal}
            ageMonths={ageMonths}
            introducedIds={introducedIds}
            upcomingCounts={upcomingCounts}
            substitution={{ babyId, foods }}
            batchHint={false}
            notice={
              allergenItem?.food ? (
                <AllergenExposureBanner
                  allergenName={
                    allergenItem.food.allergen_type ?? allergenItem.food.name
                  }
                  foodName={allergenItem.food.name}
                />
              ) : undefined
            }
            footer={
              armed ? (
                <MealActions
                  babyId={babyId}
                  date={date}
                  momentId={moment.id}
                  status={meal.status}
                  onMenuChanged={() => setRealityMomentId(moment.id)}
                  onSettled={() => settle(moment.id)}
                />
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Ce repas vient plus tard dans la journée.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setRevealed((prev) => new Set(prev).add(moment.id))
                    }
                    className="text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Le renseigner quand même
                  </button>
                </div>
              )
            }
          />
        );
      })}

      {realityMoment && (
        <MealRealitySheet
          key={`${date}|${realityMoment.id}`}
          open={!!realityMomentId}
          onOpenChange={(v) => {
            if (v) return;
            setRealityMomentId(null);
            // La feuille ne dit pas si elle a été validée ou abandonnée. On
            // rend la main au curseur dans les deux cas : après validation
            // c'est ce qu'on veut, et après un abandon le curseur rouvre le
            // même repas — il ne se passe rien de visible.
            settle(realityMoment.id);
          }}
          babyId={babyId}
          date={date}
          momentId={realityMoment.id}
          momentLabel={realityMoment.label}
          dateLabel={dateLabel}
          meal={realityMeal}
          foods={foods}
          introducedIds={introducedIds ?? []}
          birthDate={birthDate}
          dueDate={dueDate}
          ageReferenceDate={ageReferenceDate}
        />
      )}
    </div>
  );
}
