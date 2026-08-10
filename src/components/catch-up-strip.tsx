"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { composeRecipe } from "@/lib/recipe";
import { setMealResult } from "@/lib/data/meals.actions";
import {
  confirmMealsAsPlanned,
  setMealSkipped,
} from "@/lib/data/meal-reality.actions";
import { MealComposition } from "@/components/meal-composition";
import type { MealResult, MealWithDetails } from "@/lib/data/meals.types";

/**
 * La bande de rattrapage — les repas passés restés sans signal.
 *
 * Décisions (docs/feats/suivi-reel-et-rattrapage.md §4.4) :
 *
 *  · **Deux jours glissants au maximum**, plus le jour en cours depuis les
 *    créneaux horaires (creneaux-horaires §6.2) : un repas de ce matin resté
 *    sans réponse n'attend plus minuit pour être réclamé. Au-delà, la bande
 *    disparaît d'elle-même. Un parent absent une semaine ne doit pas retrouver
 *    quinze lignes en retard : ce serait exactement la dette qu'on s'interdit
 *    (D8). C'est le seul endroit du produit qui *ajoute* de la sollicitation —
 *    le premier à surveiller aux tests utilisateurs.
 *  · **« Tout s'est passé comme prévu » confirme tout d'un coup** — un tap pour
 *    deux jours. C'est ce bouton qui rend le système viable, et donc le premier
 *    à surveiller lors des tests utilisateurs.
 *  · Ton : « il vous restait deux repas », jamais « 2 repas non renseignés ».
 *
 * ── Correction du 2026-08-09 : on ne voyait pas ce qui était prévu ──────────
 * La première version tenait un repas sur **une seule ligne** : le moment, le
 * résumé des aliments, et les quatre cibles à droite. Les cibles occupaient à
 * elles seules 175 px des ~330 px utiles d'un téléphone, si bien que le résumé
 * était tronqué au troisième mot (« Déjeuner · Haricot ve… »). On demandait au
 * parent de juger un repas qu'il ne pouvait pas lire.
 *
 * Trois changements, une seule idée — rendre au repas la place de se décrire :
 *
 *  1. **Les aliments prennent leur propre ligne**, en pastilles qui passent à la
 *     ligne au lieu d'être coupées, et les cibles descendent d'un rang.
 *  2. **Le chevron déplie la composition prévue** — quantités, allergène,
 *     saison, restrictions — par la `MealComposition` de la fiche recette. Pas
 *     le pas-à-pas : on ne cuisine pas un repas d'hier, on s'en souvient.
 *     C'est le geste déjà installé sur « Les jours qui viennent ».
 *  3. **Les cibles sont légendées** (adoré / moyen / refusé / pas donné), comme
 *     dans `MealQuickRating`. Quatre émojis nus laissaient deviner, et leur
 *     `aria-label` annonçait la valeur brute de l'enum (« refuse »).
 *
 * Le survol a été écarté comme mécanisme de révélation : le rattrapage se fait
 * au téléphone, une main, et il n'y a pas de survol là-bas.
 */

export type PendingMeal = {
  date: string;
  /** « hier », « avant-hier » — jamais une date brute, on parle à un humain. */
  dayLabel: string;
  momentId: string;
  momentLabel: string;
  /** Le repas prévu — sert les pastilles repliées et la composition dépliée. */
  meal: MealWithDetails;
};

/**
 * Les quatre réponses possibles, dans l'ordre du geste. « Pas donné » porte le
 * contour en pointillés de `MealQuickRating` : à taille égale, c'est lui qui
 * distingue « comment ça s'est passé » de « ça n'a pas eu lieu ».
 */
const ANSWERS: {
  value: Exclude<MealResult, null> | "skip";
  emoji: string;
  label: string;
  cls: string;
}[] = [
  {
    value: "bien",
    emoji: "😋",
    label: "Adoré",
    cls: "border-border hover:border-primary hover:text-primary",
  },
  {
    value: "moyen",
    emoji: "😐",
    label: "Moyen",
    cls: "border-border hover:border-chart-3 hover:text-amber-700",
  },
  {
    value: "refuse",
    emoji: "🙅",
    label: "Refusé",
    cls: "border-border hover:border-destructive hover:text-destructive",
  },
  {
    value: "skip",
    emoji: "🚫",
    label: "Pas donné",
    cls: "border-dashed border-border hover:border-foreground/25 hover:text-foreground",
  },
];

export function CatchUpStrip({
  babyId,
  meals,
  ageMonths,
  fromISO,
  toISO,
  openMomentIds,
}: {
  babyId: string;
  meals: PendingMeal[];
  /** Âge projeté en mois — commande les quantités de la composition dépliée. */
  ageMonths: number;
  /** Bornes de la confirmation groupée. */
  fromISO: string;
  /** Dernier jour couvert — aujourd'hui, depuis les créneaux horaires. */
  toISO: string;
  /**
   * Créneaux du dernier jour qui n'ont pas encore fini. « Tout s'est passé comme
   * prévu » les laisse tranquilles : ce bouton ne doit jamais affirmer le dîner
   * de ce soir.
   */
  openMomentIds: string[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Optimiste : une ligne réglée disparaît tout de suite, sans attendre le
  // serveur. Le parent enchaîne au rythme du pouce, pas du réseau.
  const [done, setDone] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set());

  const remaining = meals.filter((m) => !done.has(key(m)));
  if (remaining.length === 0) return null;

  function toggle(m: PendingMeal) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key(m))) next.delete(key(m));
      else next.add(key(m));
      return next;
    });
  }

  function answer(m: PendingMeal, value: (typeof ANSWERS)[number]["value"]) {
    setDone((prev) => new Set(prev).add(key(m)));
    startTransition(async () => {
      if (value === "skip")
        await setMealSkipped(babyId, m.date, m.momentId, true);
      else await setMealResult(babyId, m.date, m.momentId, value);
      router.refresh();
    });
  }

  function confirmAll() {
    setDone(new Set(meals.map(key)));
    startTransition(async () => {
      await confirmMealsAsPlanned(babyId, fromISO, toISO, openMomentIds);
      router.refresh();
    });
  }

  // Regroupement par jour, dans l'ordre où ils se sont produits.
  const byDay = new Map<string, PendingMeal[]>();
  for (const m of remaining) {
    const list = byDay.get(m.dayLabel) ?? [];
    list.push(m);
    byDay.set(m.dayLabel, list);
  }

  return (
    <section className="rounded-lg border bg-card px-4 py-4 shadow-soft">
      {/* L'imparfait ne vaut que pour les jours révolus : un repas de ce matin
          « reste » à renseigner, il ne « restait » pas. */}
      <p className="font-heading font-semibold">
        {remaining.every((m) => m.date === toISO)
          ? remaining.length === 1
            ? "Un repas d'aujourd'hui attend votre réponse"
            : `${remaining.length} repas d'aujourd'hui attendent votre réponse`
          : remaining.length === 1
            ? "Il vous restait un repas à renseigner"
            : `Il vous restait ${remaining.length} repas à renseigner`}
      </p>

      <div className="mt-3 space-y-3">
        {[...byDay].map(([dayLabel, dayMeals]) => (
          <div key={dayLabel} className="space-y-2">
            <p className="text-xs font-semibold capitalize text-muted-foreground">
              {dayLabel}
            </p>
            {dayMeals.map((m) => (
              <MealRow
                key={key(m)}
                meal={m}
                ageMonths={ageMonths}
                isOpen={open.has(key(m))}
                onToggle={() => toggle(m)}
                onAnswer={(value) => answer(m, value)}
              />
            ))}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={confirmAll}
        disabled={isPending}
        className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-secondary text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary/80"
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Tout s'est passé comme prévu
      </button>
    </section>
  );
}

/** Identité d'un créneau — un repas est repéré par son jour et son moment. */
function key(m: PendingMeal) {
  return `${m.date}|${m.momentId}`;
}

/**
 * Un repas en retard : ce qui était prévu au-dessus, la réponse en dessous.
 *
 * Replié, il tient en deux rangées et dit déjà l'essentiel — le moment et les
 * aliments, tous, sans troncature. Déplié, il rend la composition complète.
 *
 * ── Grand écran : replié, la ligne est une ligne ────────────────────────────
 * Les deux rangées viennent du téléphone, où la largeur est la ressource rare.
 * Sur un écran d'ordinateur elles empilaient deux blocs pleine largeur par
 * repas, et la bande de rattrapage mangeait le premier écran à elle seule.
 * Replié, le repas repasse donc sur **une seule ligne** : ce qui était prévu
 * occupe 60 % de la largeur, les quatre cibles les 40 % de droite.
 *
 * Déplié, on retourne à l'empilement : la composition a besoin de toute la
 * largeur, et les cibles retrouvent leur rang du dessous — c'est le moment où
 * le parent lit avant de juger, pas celui où il balaie une liste.
 *
 * Le seuil est `lg` et non `md` : la colonne de navigation prend déjà 256 px à
 * partir de `md`, ce qui ne laisserait que ~165 px pour quatre boutons.
 */
function MealRow({
  meal: m,
  ageMonths,
  isOpen,
  onToggle,
  onAnswer,
}: {
  meal: PendingMeal;
  ageMonths: number;
  isOpen: boolean;
  onToggle: () => void;
  onAnswer: (value: (typeof ANSWERS)[number]["value"]) => void;
}) {
  const items = m.meal.meal_items;
  const hasDetails = items.length > 0;

  // Un même aliment peut figurer deux fois (purée et dessert) : une pastille.
  const chips: { id: string; name: string }[] = [];
  for (const item of items) {
    if (item.food && !chips.some((c) => c.id === item.food!.id))
      chips.push({ id: item.food.id, name: item.food.name });
  }

  const header = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-heading font-semibold">
          {m.momentLabel}
        </span>
        {chips.length > 0 && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
              >
                {c.name}
              </span>
            ))}
          </span>
        )}
      </span>
      {hasDetails && (
        <ChevronDown
          aria-hidden
          className={cn(
            "mt-0.5 size-5 shrink-0 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      )}
    </>
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border bg-card-inset",
        !isOpen && "lg:flex lg:items-stretch",
      )}
    >
      {/* Sans composition à montrer, il n'y a rien à déplier : le titre reste
          un titre plutôt qu'un bouton qui ne ferait rien. */}
      {hasDetails ? (
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={onToggle}
          className={cn(
            "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40",
            !isOpen && "lg:w-3/5",
          )}
        >
          {header}
        </button>
      ) : (
        <div
          className={cn(
            "flex items-start gap-3 px-3 py-2.5",
            !isOpen && "lg:w-3/5",
          )}
        >
          {header}
        </div>
      )}

      {isOpen && hasDetails && (
        <div className="border-t bg-card px-3 py-3">
          <h4 className="mb-2.5 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Ce qui était prévu
          </h4>
          <MealComposition
            lines={composeRecipe(items, ageMonths).lines}
            month={Number(m.date.slice(5, 7))}
          />
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-4 gap-1.5 border-t p-1.5",
          // Sur la ligne unique, la séparation est verticale et la zone ne se
          // laisse pas comprimer par des pastilles d'aliments trop longues.
          !isOpen && "lg:w-2/5 lg:shrink-0 lg:border-l lg:border-t-0",
        )}
      >
        {ANSWERS.map((a) => (
          <button
            key={a.value}
            type="button"
            onClick={() => onAnswer(a.value)}
            className={cn(
              "flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-md border-[1.5px] bg-card px-1 text-[0.6875rem] font-semibold leading-none text-muted-foreground transition-colors",
              a.cls,
            )}
          >
            <span aria-hidden className="text-xl leading-none">
              {a.emoji}
            </span>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
