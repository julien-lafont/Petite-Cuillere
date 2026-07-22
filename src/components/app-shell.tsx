"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Carrot,
  BarChart3,
  ShieldAlert,
  Utensils,
  Baby,
  ShoppingCart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";

type BabyShellInfo = {
  prenom: string;
};

/**
 * Navigation partagée entre la barre latérale (PC) et la barre du bas (mobile).
 * L'ordre reflète les priorités d'usage : "Aujourd'hui" en premier (réflexe mobile).
 */
const NAV_ITEMS = [
  { href: "/", label: "En cuisine", icon: Utensils },
  { href: "/semaine", label: "Semaine", icon: CalendarDays },
  { href: "/aliments", label: "Aliments", icon: Carrot },
  { href: "/courses", label: "Courses", icon: ShoppingCart },
  { href: "/allergenes", label: "Allergènes", icon: ShieldAlert },
  { href: "/stats", label: "Stats", icon: BarChart3 },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Petit logo de marque : icône dans un carré arrondi vert. */
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Baby className="size-5" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <p className="font-heading text-base font-extrabold tracking-tight">
            Baby Food
          </p>
          <p className="text-xs text-muted-foreground">Tracker</p>
        </div>
      )}
    </div>
  );
}

/** Pastille bébé, cliquable vers la fiche. */
function BabyChip({ baby }: { baby: BabyShellInfo }) {
  return (
    <Link
      href="/bebe"
      className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent/40"
    >
      <span className="grid size-6 place-items-center rounded-full bg-secondary text-secondary-foreground text-xs font-bold">
        {baby.prenom.charAt(0).toUpperCase()}
      </span>
      <span className="font-medium">{baby.prenom}</span>
    </Link>
  );
}

export function AppShell({
  children,
  userEmail,
  baby,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  baby: BabyShellInfo;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      {/* Barre latérale — PC uniquement */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar px-4 py-6 md:flex">
        <div className="px-2">
          <Brand />
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <item.icon className="size-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border bg-card p-3">
            <p className="mb-2 px-1 text-xs font-medium text-muted-foreground">
              Suivi de
            </p>
            <BabyChip baby={baby} />
          </div>
          {userEmail && (
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {userEmail}
              </span>
              <SignOutButton />
            </div>
          )}
        </div>
      </aside>

      {/* En-tête — mobile uniquement */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-md md:hidden">
        <Brand compact />
        <BabyChip baby={baby} />
      </header>

      {/* Contenu principal */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl px-4 pb-24 pt-6 md:px-8 md:pb-12 md:pt-10">
          {children}
        </div>
      </main>

      {/* Barre de navigation — mobile uniquement */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-6">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon
                  className={cn("size-5", active && "fill-primary/15")}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
