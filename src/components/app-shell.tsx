"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Soup, CalendarDays, ShoppingBasket, Sprout, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_METHODE_URL } from "@/lib/routes";
import { SignOutButton } from "@/components/sign-out-button";
import { NavPending } from "@/components/nav-pending";
import { BabySwitcher } from "@/components/baby-switcher";
import { BrandMark } from "@/components/brand-mark";
import { VoiceProvider } from "@/components/voice-provider";
import { VoiceDock } from "@/components/voice-dock";

type BabyShellInfo = {
  id: string;
  prenom: string;
  avatar_color: string | null;
};

/**
 * Three navigation destinations, matching the parent's three moments (see
 * docs/ux-redesign.md §4) — not the database tables:
 *
 *   Aujourd'hui  "what do I make them, right now?"        ~90 % of openings
 *   Ma semaine   "what do I buy and prepare?"             ~8 %
 *   Découvertes  "where are they at?"                     ~2 %
 *
 * Each destination groups sub-sections (`section`) that stay distinct routes but
 * share one main tab. This list feeds the mobile bottom bar (see
 * `MOBILE_NAV_ITEMS`) and the sub-tabs shown at the top of the content
 * (`SectionTabs`).
 */
const NAV_ITEMS = [
  {
    href: "/aujourdhui",
    label: "Aujourd'hui",
    icon: Soup,
    section: ["/aujourdhui"],
    subnav: [],
    // On desktop, Planning and Courses each have their own entry in the
    // sidebar (see DESKTOP_NAV_ITEMS): repeating the sub-tab here would be
    // redundant. It only stays useful on mobile.
    hideSubnavOnDesktop: false,
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
    hideSubnavOnDesktop: true,
  },
  {
    href: "/aliments",
    label: "Découvertes",
    icon: Sprout,
    // The two method pages stay in the section, which keeps "Découvertes" lit in
    // the bottom bar while they are read. They do not appear in `subnav` for all
    // that: they carry their own switcher (`MethodSwitch`), see `SectionTabs`.
    section: ["/aliments", "/allergenes", "/stats", "/methode"],
    subnav: [
      { href: "/aliments", label: "Aliments" },
      { href: "/allergenes", label: "Allergènes" },
      { href: "/stats", label: "Progression" },
    ],
    hideSubnavOnDesktop: false,
  },
] as const;

/**
 * Mobile bottom bar: four tabs, two on each side of the mic.
 *
 * The mic left the "Aujourd'hui" page for the centre of this bar (see
 * `voice-dock`), and a centred badge forces an even number of targets around it.
 * "Mon foyer", which was only reachable through a header icon, gains a readable
 * place — the header now carries nothing but the mark and the child switcher,
 * and the three daily destinations keep their rank.
 *
 * The labels are shortened: at four columns, each is ~72 px on a small phone,
 * which does not fit "Aujourd'hui" at 0.8 rem.
 */
const MOBILE_NAV_ITEMS = [
  { ...NAV_ITEMS[0], shortLabel: "Aujourd'hui" },
  { ...NAV_ITEMS[1], shortLabel: "Semaine" },
  { ...NAV_ITEMS[2], shortLabel: "Découvertes" },
  {
    href: "/foyer",
    label: "Mon foyer",
    shortLabel: "Foyer",
    icon: Home,
    section: ["/foyer"],
  },
] as const;

/**
 * Desktop sidebar only: Planning and Courses are two full entries there rather
 * than a sub-tab, space not being scarce as it is on the mobile bottom bar.
 */
const DESKTOP_NAV_ITEMS = [
  NAV_ITEMS[0],
  {
    href: "/semaine",
    label: "Planning",
    icon: CalendarDays,
    section: ["/semaine"],
  },
  {
    href: "/courses",
    label: "Courses",
    icon: ShoppingBasket,
    section: ["/courses"],
  },
  NAV_ITEMS[2],
] as const;

function inSection(pathname: string, section: readonly string[]) {
  return section.some((href) => pathname.startsWith(href));
}

/**
 * A section's sub-navigation. Shown only when the section has more than one —
 * on "Aujourd'hui" the screen stays bare, there is nothing to arbitrate.
 */
function SectionTabs({ pathname }: { pathname: string }) {
  /*
   * The method pages carry their own switcher — "La méthode | Allergènes", set
   * by the content (`MethodSwitch`), and in the same shape as this row. Without
   * this early return they would show two of them stacked, and the upper one has
   * no tab to light up: neither Aliments, nor Allergènes, nor Progression is the
   * open page.
   */
  if (pathname.startsWith(APP_METHODE_URL)) return null;

  const current = NAV_ITEMS.find((item) => inSection(pathname, item.section));
  if (!current || current.subnav.length === 0) return null;

  return (
    <nav
      className={cn(
        "mb-6 flex gap-1 rounded-full bg-muted p-1",
        current.hideSubnavOnDesktop && "md:hidden",
      )}
    >
      {current.subnav.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex-1 rounded-full px-3 py-2.5 text-center text-sm font-semibold transition-colors",
              active
                ? "bg-card text-foreground shadow-soft"
                : // On click the tab takes on the selected look at once, without
                  // waiting for `pathname` to change (a second later).
                  "text-muted-foreground hover:text-foreground has-[[data-pending]]:bg-card has-[[data-pending]]:text-foreground has-[[data-pending]]:shadow-soft",
            )}
          >
            {tab.label}
            <NavPending className="absolute top-1/2 right-3 size-1.5 -translate-y-1/2 rounded-full bg-current" />
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
    /*
     * Dictation is mounted by the shell, not by a page: that is what lets the
     * mic live in the bottom bar — so everywhere — and lets the two entry
     * points, the large-screen card and the thumb badge, drive one and the same
     * sheet.
     */
    <VoiceProvider>
      <div className="min-h-screen bg-background">
        {/* Sidebar — desktop only */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar px-4 py-6 md:flex">
          <div className="px-2">
            <BrandMark />
          </div>

          <nav className="mt-8 flex flex-1 flex-col gap-1">
            {DESKTOP_NAV_ITEMS.map((item) => {
              const active = inSection(pathname, item.section);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-full px-4 py-3 font-semibold transition-colors",
                    active
                      ? "bg-secondary text-secondary-foreground"
                      : // `not-has-...`: the hover fades as soon as the link goes
                        // pending, otherwise the two backgrounds would fight over
                        // the destination the pointer happens to rest on.
                        "text-muted-foreground not-has-[[data-pending]]:hover:bg-muted not-has-[[data-pending]]:hover:text-foreground has-[[data-pending]]:bg-secondary has-[[data-pending]]:text-secondary-foreground",
                  )}
                >
                  <item.icon className="size-5 shrink-0" />
                  {item.label}
                  <NavPending className="ml-auto size-1.5 rounded-full bg-current" />
                </Link>
              );
            })}
          </nav>

          {/*
           * A single entry point at the foot of the column, instead of the old
           * "truncated first name + sign out" pair: the user's name was
           * unreadable there and its role as a link invisible. "Mon foyer" now
           * gathers their profile, their children and their helpers; signing out
           * lives in the screen, not in the bar.
           */}
          <div className="mt-auto flex flex-col gap-2">
            <BabySwitcher babies={babies} activeId={activeBabyId} />
            <Link
              href="/foyer"
              className={cn(
                "flex items-center gap-2.5 rounded-full border bg-card px-4 py-2.5 transition-colors not-has-[[data-pending]]:hover:bg-muted has-[[data-pending]]:border-primary/30 has-[[data-pending]]:bg-secondary has-[[data-pending]]:text-secondary-foreground",
                pathname.startsWith("/foyer") &&
                  "border-primary/30 bg-secondary text-secondary-foreground",
              )}
            >
              <Home className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Mon foyer</span>
                {(userPrenom || userEmail) && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {userPrenom || userEmail}
                  </span>
                )}
              </span>
              <NavPending className="size-1.5 shrink-0 rounded-full bg-current" />
            </Link>
            {/*
             * Signing out closes the column, apart from the rest: it is an exit,
             * not a destination. On mobile, where this bar does not exist, it is
             * repeated at the foot of the "Mon foyer" screen.
             */}
            <SignOutButton className="w-full justify-start" />
          </div>
        </aside>

        {/*
         * Header — mobile only. "Mon foyer" moved down into the bottom bar, where
         * the mic made a fourth target necessary: all that is left here is the
         * mark and the child switcher, that is, enough to know where you are and
         * who for.
         */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-background/85 px-4 backdrop-blur-md md:hidden">
          <BrandMark compact />
          <BabySwitcher babies={babies} activeId={activeBabyId} />
        </header>

        {/* Main content */}
        <main className="md:pl-64">
          <div className="mx-auto max-w-5xl px-4 pb-32 pt-6 md:px-8 md:pb-12 md:pt-10">
            <SectionTabs pathname={pathname} />
            {children}
          </div>
        </main>

        {/*
         * Bottom navigation bar — mobile only.
         * Four targets ~72 px wide by 72 px tall, with the mic in the middle: all
         * of it stays reachable by thumb, one-handed, the centre badge landing
         * exactly where the thumb rests without aiming.
         */}
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur-md md:hidden">
          <div className="mx-auto grid max-w-lg grid-cols-[1fr_1fr_4.5rem_1fr_1fr]">
            {MOBILE_NAV_ITEMS.slice(0, 2).map((item) => (
              <MobileTab key={item.href} item={item} pathname={pathname} />
            ))}
            <VoiceDock />
            {MOBILE_NAV_ITEMS.slice(2).map((item) => (
              <MobileTab key={item.href} item={item} pathname={pathname} />
            ))}
          </div>
        </nav>
      </div>
    </VoiceProvider>
  );
}

/** Un onglet de la barre basse. */
function MobileTab({
  item,
  pathname,
}: {
  item: (typeof MOBILE_NAV_ITEMS)[number];
  pathname: string;
}) {
  const active = inSection(pathname, item.section);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 px-0.5 text-[0.7rem] font-semibold transition-colors",
        active
          ? "text-primary"
          : "text-muted-foreground has-[[data-pending]]:text-primary",
      )}
    >
      <span
        className={cn(
          "relative grid h-8 w-12 place-items-center rounded-full transition-colors",
          active ? "bg-secondary" : "has-[[data-pending]]:bg-secondary",
        )}
      >
        <item.icon className="size-6" />
        {/*
         * Under the thumb, the finger hides the icon: the pending indicator sits
         * below the badge, where it stays visible.
         */}
        <NavPending className="absolute -bottom-0.5 size-1.5 rounded-full bg-current" />
      </span>
      <span className="max-w-full truncate">{item.shortLabel}</span>
    </Link>
  );
}
