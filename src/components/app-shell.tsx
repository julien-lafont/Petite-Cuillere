"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Soup, CalendarDays, ShoppingBasket, Sprout, Home } from "lucide-react";
import { cn } from "@/lib/utils";
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
 * Navigation à trois destinations, correspondant aux trois moments de vie du
 * parent (cf. docs/ux-redesign.md §4) — et non aux tables de la base :
 *
 *   Aujourd'hui  « qu'est-ce que je lui prépare, là, maintenant ? »   ~90 % des ouvertures
 *   Ma semaine   « qu'est-ce que j'achète et je prépare ? »           ~8 %
 *   Découvertes  « où en est-il ? »                                   ~2 %
 *
 * Chaque destination regroupe des sous-sections (`section`) qui restent des
 * routes distinctes mais partagent un onglet principal. C'est cette liste qui
 * nourrit la barre basse mobile (cf. `MOBILE_NAV_ITEMS`) et les sous-onglets
 * affichés en haut du contenu (`SectionTabs`).
 */
const NAV_ITEMS = [
  {
    href: "/aujourdhui",
    label: "Aujourd'hui",
    icon: Soup,
    section: ["/aujourdhui"],
    subnav: [],
    // Sur desktop, Planning et Courses ont chacun leur entrée dans la
    // colonne latérale (cf. DESKTOP_NAV_ITEMS) : reproduire le sous-onglet
    // ici serait redondant. Il ne reste utile que sur mobile.
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
 * Barre basse mobile : quatre onglets, deux de chaque côté du micro.
 *
 * Le micro a quitté la page « Aujourd'hui » pour le centre de cette barre (cf.
 * `voice-dock`), et une pastille centrée impose un nombre pair de cibles autour
 * d'elle. « Mon foyer », qui n'était joignable que par une icône de l'en-tête,
 * y gagne une place lisible — l'en-tête ne porte plus que la marque et le
 * sélecteur d'enfant, et les trois destinations quotidiennes gardent leur rang.
 *
 * Les libellés sont raccourcis : à quatre colonnes, chacune fait ~72 px sur un
 * petit téléphone, ce qui ne tient pas « Aujourd'hui » en 0,8 rem.
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
 * Colonne latérale desktop uniquement : Planning et Courses y sont deux
 * entrées à part entière plutôt qu'un sous-onglet, la place ne manquant pas
 * comme sur la barre basse mobile.
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
 * Sous-navigation d'une section. Affichée seulement quand la section en compte
 * plusieurs — sur « Aujourd'hui », l'écran reste nu, il n'y a rien à arbitrer.
 */
function SectionTabs({ pathname }: { pathname: string }) {
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
                : // Dès le clic, l'onglet prend l'apparence sélectionnée, sans
                  // attendre que `pathname` change (une seconde plus tard).
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
     * La dictée est montée par la coquille, et non par une page : c'est ce qui
     * permet au micro de vivre dans la barre basse — donc partout — et aux deux
     * points d'entrée, la carte sur grand écran et la pastille au pouce, de
     * piloter une seule et même feuille.
     */
    <VoiceProvider>
      <div className="min-h-screen bg-background">
        {/* Barre latérale — PC uniquement */}
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
                      : // `not-has-...` : le survol s'efface dès que le lien passe
                        // en attente, sinon les deux fonds se disputeraient la
                        // destination sur laquelle le pointeur est resté.
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
           * Un seul point d'entrée en pied de colonne, au lieu du couple « prénom
           * tronqué + déconnexion » d'avant : le nom de l'utilisateur y était
           * illisible et son rôle de lien invisible. « Mon foyer » regroupe
           * désormais son profil, ses enfants et ses aidants ; la déconnexion vit
           * dans l'écran, pas dans la barre.
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
             * La déconnexion ferme la colonne, à part du reste : c'est une sortie,
             * pas une destination. Sur mobile, où cette barre n'existe pas, elle
             * est reprise en pied de l'écran « Mon foyer ».
             */}
            <SignOutButton className="w-full justify-start" />
          </div>
        </aside>

        {/*
         * En-tête — mobile uniquement. « Mon foyer » en est descendu vers la barre
         * basse, où le micro a rendu une quatrième cible nécessaire : il n'y reste
         * que la marque et le sélecteur d'enfant, c'est-à-dire de quoi savoir où
         * l'on est et pour qui.
         */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-background/85 px-4 backdrop-blur-md md:hidden">
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
         * Quatre cibles de ~72 px de large sur 72 px de haut, et le micro au
         * milieu : le tout reste atteignable au pouce, d'une seule main, la
         * pastille centrale tombant précisément là où il se pose sans viser.
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
         * Au pouce, le doigt masque l'icône : le témoin d'attente se place sous
         * la pastille, là où il reste visible.
         */}
        <NavPending className="absolute -bottom-0.5 size-1.5 rounded-full bg-current" />
      </span>
      <span className="max-w-full truncate">{item.shortLabel}</span>
    </Link>
  );
}
