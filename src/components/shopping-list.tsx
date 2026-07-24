"use client";

import { useState, useMemo, useTransition } from "react";
import { Check, Snowflake, Leaf, Snowflake as Freeze } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FreshnessAdvice } from "@/lib/season";
import { purchaseLabel } from "@/lib/shopping-quantity";
import { setShoppingCheck } from "@/lib/data/shopping.actions";

export type ShoppingItem = {
  id: string;
  name: string;
  category: string | null;
  count: number;
  /** Grammes cumulés sur la période (null si non pertinent). */
  grams: number | null;
  advice: FreshnessAdvice;
};

const CATEGORY_LABEL: Record<string, { emoji: string; label: string }> = {
  légume: { emoji: "🥕", label: "Légumes" },
  fruit: { emoji: "🍎", label: "Fruits" },
  protéine: { emoji: "🍗", label: "Viandes, poissons, œufs" },
  laitier: { emoji: "🧀", label: "Produits laitiers" },
  féculent: { emoji: "🌾", label: "Féculents" },
  "matière grasse": { emoji: "🫒", label: "Matières grasses" },
  autre: { emoji: "🥄", label: "Divers" },
};

export function ShoppingList({
  items,
  weekStart,
  initialChecked,
}: {
  items: ShoppingItem[];
  weekStart: string;
  initialChecked: string[];
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(initialChecked));
  const [, startTransition] = useTransition();

  function toggle(id: string) {
    const willCheck = !checked.has(id);
    setChecked((prev) => {
      const next = new Set(prev);
      if (willCheck) next.add(id);
      else next.delete(id);
      return next;
    });
    startTransition(() => setShoppingCheck(weekStart, id, willCheck));
  }

  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const it of items) {
      const key = it.category ?? "autre";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return map;
  }, [items]);

  // Aliments qui reviennent ≥ 3 fois : candidats à la préparation en lot.
  const batch = useMemo(
    () => items.filter((it) => it.count >= 3).sort((a, b) => b.count - a.count),
    [items],
  );

  const remaining = items.length - checked.size;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {remaining > 0
          ? `${remaining} article${remaining > 1 ? "s" : ""} à acheter`
          : "Tout est coché — prêt à cuisiner 🎉"}
      </p>

      {/* Session de préparation : cuisiner en une fois et congeler */}
      {batch.length > 0 && (
        <section className="rounded-lg border border-primary/20 bg-secondary/50 p-4">
          <div className="flex items-center gap-2">
            <Freeze className="size-4 text-primary" />
            <h2 className="font-heading text-base font-semibold">
              À préparer en lot
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Ces aliments reviennent souvent : cuisinez-les en une fois et
            congelez les portions.
          </p>
          <ul className="mt-3 space-y-1.5">
            {batch.map((it) => (
              <li
                key={it.id}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span className="font-medium">{it.name}</span>
                <span className="text-muted-foreground">
                  {it.count} repas · congelez {it.count - 1} portion
                  {it.count - 1 > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {[...groups.entries()].map(([category, list]) => {
        const meta = CATEGORY_LABEL[category] ?? CATEGORY_LABEL.autre;
        return (
          <div key={category} className="space-y-2">
            <h3 className="font-heading text-sm font-semibold text-muted-foreground">
              {meta.emoji} {meta.label}
            </h3>
            <div className="divide-y overflow-hidden rounded-lg border bg-card">
              {list.map((it) => {
                const done = checked.has(it.id);
                return (
                  <button
                    key={it.id}
                    onClick={() => toggle(it.id)}
                    className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors",
                        done
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40",
                      )}
                    >
                      {done && <Check className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block font-medium",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {it.name}
                      </span>
                      <span
                        className={cn(
                          "block text-sm text-muted-foreground",
                          done && "line-through",
                        )}
                      >
                        {purchaseLabel(it.name, it.category, it.grams, it.count)}
                      </span>
                    </span>
                    {!done && it.advice === "frais" && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                        <Leaf className="size-3" />
                        Frais
                      </span>
                    )}
                    {!done && it.advice === "surgele" && (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        <Snowflake className="size-3" />
                        Surgelé ok
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
