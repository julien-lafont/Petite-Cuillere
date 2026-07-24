"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Soup, ShoppingBasket, Sprout, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/sign-out-button";
import { BabySwitcher } from "@/components/baby-switcher";
import { BrandMark } from "@/components/brand-mark";

type BabyShellInfo = {
  id: string;
  prenom: string;
};

/**
 * Navigation à trois destinations, correspondant aux trois moments de vie du
 * parent (cf. docs/ux-redesign.md §4) — et non aux tables de la base :
 *
 *   Aujourd'hui  « qu'est-ce que je lui prépare, là, maintenant ? »   ~90 % des ouvertures
 *   Ma semaine   « qu'est-ce que j'achète et je prépare ? »           ~8 %
 *   Découvertes  « où en est-il ? »                                   ~2 %
 *
 * Chaque destination regroupe des sous-sections (`section`) qui restent des
 * routes distinctes mais partagent un onglet principal.
 */
const NAV_ITEMS = [
  {
    href: "/aujourdhui",
    label: "Aujourd'hui",
    icon: Soup,
    section: ["/aujourdhui"],
    subnav: [],
  },
  {
    href: "/semaine",
    label: "Ma semaine",
    icon: ShoppingBasket,
    section: ["/semaine", "/courses"],
    subnav: [
      { href: "/semaine", label: "Planning" },
      { href: "/courses", label: "Courses" },
    ],
  },
  {
    href: "/aliments",
    label: "Découvertes",
    icon: Sprout,
    section: ["/aliments", "/allergenes", "/stats"],
    subnav: [
      { href: "/aliments", label: "Aliments" },
      { href: "/allergenes", label: "Allergènes" },
      { href: "/stats", label: "Progression" },
    ],
  },
] as const;

function inSection(pathname: string, section: readonly string[]) {
  return section.some((href) => pathname.startsWith(href));
}

/**
 * Sous-navigation d'une section. Affichée seulement quand la section en compte
 * plusieurs — sur « Aujourd'hui », l'écran reste nu, il n'y a rien à arbitrer.
 */
function SectionTabs({ pathname }: { pathname: string }) {
  const current = NAV_ITEMS.find((item) => inSection(pathname, item.section));
  if (!current || current.subnav.length === 0) return null;

  return (
    <nav className="mb-6 flex gap-1 rounded-lg bg-muted p-1">
      {current.subnav.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 rounded-md px-3 py-2.5 text-center text-sm font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  children,
  userEmail,
  userPrenom,
  babies,
  activeBabyId,
}: {
  children: React.ReactNode;
  userEmail?: string | null;
  userPrenom?: string | null;
  babies: BabyShellInfo[];
  activeBabyId: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      {/* Barre latérale — PC uniquement */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar px-4 py-6 md:flex">
        <div className="px-2">
          <BrandMark />
        </div>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = inSection(pathname, item.section);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-3 font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2">
          <div className="flex flex-col gap-2">
            <BabySwitcher babies={babies} activeId={activeBabyId} />
            <Link
              href="/foyer"
              className={cn(
                "flex items-center gap-2 rounded-md border bg-card px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                pathname.startsWith("/foyer") &&
                  "border-primary/30 bg-secondary text-secondary-foreground",
              )}
            >
              <Home className="size-4 shrink-0" />
              <span className="font-medium">Mon foyer</span>
            </Link>
          </div>
          {(userPrenom || userEmail) && (
            <div className="flex items-center justify-between gap-2 px-1">
              <Link
                href="/profil"
                className="min-w-0 truncate text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                {userPrenom || userEmail}
              </Link>
              <SignOutButton />
            </div>
          )}
        </div>
      </aside>

      {/* En-tête — mobile uniquement */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/85 px-4 backdrop-blur-md md:hidden">
        <BrandMark compact />
        <BabySwitcher babies={babies} activeId={activeBabyId} />
      </header>

      {/* Contenu principal */}
      <main className="md:pl-64">
        <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 md:px-8 md:pb-12 md:pt-10">
          <SectionTabs pathname={pathname} />
          {children}
        </div>
      </main>

      {/*
       * Barre de navigation basse — mobile uniquement.
       * Trois cibles de ~110 px de large sur 72 px de haut : atteignables au
       * pouce, impossibles à manquer, y compris d'une seule main.
       */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-md md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {NAV_ITEMS.map((item) => {
            const active = inSection(pathname, item.section);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 text-[0.8rem] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-14 place-items-center rounded-md transition-colors",
                    active && "bg-secondary",
                  )}
                >
                  <item.icon className="size-6" />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
