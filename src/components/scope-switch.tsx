"use client";

import Link from "next/link";
import { NavPending } from "@/components/nav-pending";
import { cn } from "@/lib/utils";

/**
 * Bascule « Cette semaine » / « Ce mois-ci » pour la liste de courses. Le mode
 * mensuel est ce qui rend la préparation en lot possible (cf. docs/ux-redesign.md
 * §6). Implémenté en liens (searchParam) pour rester lisible et partageable.
 */
export function ScopeSwitch({ scope }: { scope: "semaine" | "mois" }) {
  const options = [
    { value: "semaine", label: "Cette semaine" },
    { value: "mois", label: "Ce mois-ci" },
  ] as const;

  return (
    <div className="flex gap-1 rounded-lg bg-muted p-1">
      {options.map((opt) => {
        const active = scope === opt.value;
        return (
          <Link
            key={opt.value}
            href={`/courses?portee=${opt.value}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex-1 rounded-md px-3 py-2.5 text-center text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground has-[[data-pending]]:bg-card has-[[data-pending]]:text-foreground has-[[data-pending]]:shadow-soft",
            )}
          >
            {opt.label}
            <NavPending className="absolute top-1/2 right-2.5 size-1.5 -translate-y-1/2 rounded-full bg-current" />
          </Link>
        );
      })}
    </div>
  );
}
