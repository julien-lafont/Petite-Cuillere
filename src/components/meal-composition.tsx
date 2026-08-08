"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Leaf, Loader2, Repeat, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";
import { freshnessAdvice } from "@/lib/season";
import { substituteFood } from "@/lib/data/meal-reality.actions";
import { findSubstitutes } from "@/lib/program/substitute";
import type { MealFoodLine } from "@/lib/recipe";
import type { FoodRow } from "@/lib/data/foods";

/**
 * Ce qu'il y a dans l'assiette : un aliment par ligne, avec **tout ce qui le
 * concerne sur cette ligne** — quantité, allergène, saison, restriction, et le
 * remplacement s'il manque quelque chose.
 *
 * La quantité colle au nom (`courge  ~150 g`) au lieu d'être poussée au bord
 * droit de la carte : sur un écran large, un `justify-between` l'éloignait de
 * plusieurs centaines de pixels de l'aliment auquel elle se rapporte, et on ne
 * la lisait plus.
 *
 * Saison et restriction se lisaient auparavant dans un pavé de conseils sous la
 * recette (« la pêche est hors saison… ») : le parent devait refaire lui-même le
 * rapprochement avec la ligne concernée. Elles sont maintenant posées dessus.
 *
 * ── Le remplacement ────────────────────────────────────────────────────────
 * Corriger **avant** le repas vaut mieux que constater après (cf.
 * docs/feats/suivi-reel-et-rattrapage.md §4.2) : le parent est devant son frigo,
 * il obtient une réponse utile en un tap, et le programme récupère une donnée
 * propre au lieu d'un silence.
 *
 * L'action s'appelle « Remplacer », pas « je n'en ai pas » : le lien décrivait
 * la situation du parent au lieu de nommer ce que le bouton fait, et personne ne
 * comprenait qu'il y avait là une action. Trois remplaçants, pas plus : de quoi
 * choisir, pas de quoi hésiter.
 */
export function MealComposition({
  lines,
  month,
  substitution,
}: {
  lines: MealFoodLine[];
  /** Mois du repas (1..12), pour l'indicateur de saison. */
  month: number;
  /**
   * Active le remplacement. Absent = fiche en lecture seule (aperçu sans
   * compte, jours à venir repliés).
   */
  substitution?: {
    babyId: string;
    date: string;
    momentId: string;
    foods: FoodRow[];
    introducedIds: string[];
    ageMonths: number;
    /** Occurrences à venir par aliment — pour proposer le moins vu d'abord. */
    usage?: Record<string, number>;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const introducedSet = new Set(substitution?.introducedIds ?? []);
  const inMeal = new Set(lines.map((l) => l.id));

  function swap(fromId: string, toId: string) {
    if (!substitution) return;
    const { babyId, date, momentId } = substitution;
    setOpenId(null);
    startTransition(async () => {
      const res = await substituteFood(babyId, date, momentId, fromId, toId);
      router.refresh();
      setMessage(res.sentence);
    });
  }

  return (
    <div className="space-y-2">
      <ul>
        {lines.map((line, i) => {
          const food = substitution?.foods.find((f) => f.id === line.id);
          // Une dose du protocole allergènes ne se remplace pas : c'est le
          // support prescrit, à ce palier-là. Proposer un échange ici casserait
          // le protocole sans que le parent puisse le savoir.
          const substitutes =
            substitution && food && !line.isPrescribedDose
              ? findSubstitutes(food, substitution.foods, {
                  introducedIds: introducedSet,
                  usage: substitution.usage,
                  ageMonths: substitution.ageMonths,
                  exclude: inMeal,
                })
              : [];
          const isOpen = openId === line.id;
          const advice = freshnessAdvice(line.season, month);

          return (
            <li
              key={line.id}
              className={cn(
                "py-2 first:pt-0 last:pb-0",
                // Le trait sépare la purée salée du dessert : deux
                // préparations, deux moments du repas.
                i > 0 && line.course !== lines[i - 1].course && "border-t",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-heading text-base font-semibold">
                    {line.name}
                  </span>
                  {/* Une dose du protocole allergènes n'est pas un repère à
                      ajuster selon l'appétit : on la distingue de la portion. */}
                  <span
                    className={cn(
                      "text-sm font-medium tabular-nums",
                      line.isPrescribedDose
                        ? "text-novelty"
                        : "text-muted-foreground",
                    )}
                  >
                    {line.portion.label}
                  </span>
                  {line.isAllergen && (
                    <Tag className="bg-novelty-soft text-novelty">
                      allergène
                    </Tag>
                  )}
                  {advice === "frais" && (
                    <Tag
                      className="bg-secondary text-secondary-foreground"
                      title={`${line.name} est de saison — profitez-en frais.`}
                    >
                      <Leaf className="size-3" />
                      de saison
                    </Tag>
                  )}
                  {advice === "surgele" && (
                    <Tag
                      className="bg-muted text-muted-foreground"
                      title={`${line.name} est hors saison — le surgelé fait très bien l'affaire.`}
                    >
                      <Snowflake className="size-3" />
                      surgelé
                    </Tag>
                  )}
                </div>

                {substitutes.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenId(isOpen ? null : line.id)}
                    className={cn(
                      // Posé sur le crème de la colonne, le bouton se détache
                      // par son fond blanc : en pointillés sur fond teinté, il
                      // se lisait comme une zone vide à remplir.
                      "flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] bg-card px-2.5 text-xs font-semibold transition-colors",
                      isOpen
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary hover:text-primary",
                    )}
                  >
                    <Repeat className="size-3.5" />
                    Remplacer
                  </button>
                )}
              </div>

              {line.restrictions && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{line.restrictions}</span>
                </p>
              )}

              {isOpen && (
                <div className="mt-2 rounded-md bg-muted/60 p-2.5">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Remplacer {line.name.toLowerCase()} par
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {substitutes.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={isPending}
                        onClick={() => swap(line.id, s.id)}
                        className="flex min-h-9 items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                      >
                        {isPending && (
                          <Loader2 className="size-3 animate-spin" />
                        )}
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {message && (
        <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
          {message}
        </p>
      )}
    </div>
  );
}

/** Pastille d'information posée sur un aliment — fond pâle, texte contrasté. */
function Tag({
  className,
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 self-center rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
