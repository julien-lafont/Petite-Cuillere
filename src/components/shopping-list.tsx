"use client";

import { useState, useTransition } from "react";
import { Check, Snowflake, Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FreshnessAdvice } from "@/lib/season";
import { setShoppingCheck } from "@/lib/data/shopping.actions";

export type ShoppingItem = {
  id: string;
  name: string;
  category: string | null;
  count: number;
  advice: FreshnessAdvice;
};

const CATEGORY_EMOJI: Record<string, string> = {
  légume: "🥕",
  fruit: "🍎",
  protéine: "🍗",
  laitier: "🧀",
  féculent: "🌾",
  "matière grasse": "🫒",
  autre: "🥄",
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

  // Groupement par catégorie
  const groups = new Map<string, ShoppingItem[]>();
  for (const it of items) {
    const key = it.category ?? "autre";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }

  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([category, list]) => (
        <div key={category} className="space-y-2">
          <h3 className="font-heading text-sm font-bold text-muted-foreground">
            {CATEGORY_EMOJI[category] ?? "🥄"} {category}
          </h3>
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {list.map((it) => {
              const done = checked.has(it.id);
              return (
                <button
                  key={it.id}
                  onClick={() => toggle(it.id)}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/30"
                >
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {done && <Check className="size-3.5" />}
                  </span>
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      done && "text-muted-foreground line-through",
                    )}
                  >
                    {it.name}
                  </span>
                  {!done && it.advice === "frais" && (
                    <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                      <Leaf className="size-3" />
                      Frais
                    </span>
                  )}
                  {!done && it.advice === "surgele" && (
                    <span className="flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                      <Snowflake className="size-3" />
                      Surgelé
                    </span>
                  )}
                  {it.count > 1 && (
                    <span className="text-xs text-muted-foreground">
                      ×{it.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
