import Link from "next/link";
import { UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";
import { APP_VERSION } from "@/lib/version";

/**
 * Header and footer for the public screens: the landing (`app/page.tsx`) and the
 * "La méthode" pages, open without an account so anyone can check what we
 * promise before signing up.
 */

/**
 * The two method pages, public, cited identically at the top and the bottom.
 *
 * These are the prerendered versions: they are the ones that open with no server
 * round trip, and the only indexed ones. The `/methode…` routes serve the same
 * text to signed-in readers, inside the app shell.
 */
const METHOD_LINKS = [
  { href: METHODE_URL, label: "La méthode" },
  { href: ALLERGENES_URL, label: "Allergènes" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-md">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-5 md:px-8">
        {/*
         * The mark gives way before the bar does: `min-w-0` lets it shrink and
         * the name truncates rather than pushing the buttons off screen. Without
         * it, a `shrink-0` on each side leaves the browser no way out — which is
         * exactly what overflowed by 63 px on a 375 px screen.
         */}
        <Link
          href="/"
          aria-label="Petite Cuillère, accueil"
          className="min-w-0"
        >
          <BrandMark />
        </Link>

        <nav className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-5">
          {/*
           * The two method pages leave the bar below 768 px: they move to the
           * footer, and the thumb keeps a single target. "Se connecter" stays
           * reachable throughout — it is the entry point for returning parents.
           */}
          {METHOD_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hidden rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground md:inline-flex"
            >
              {link.label}
            </Link>
          ))}
          {/*
           * A middle step between the method links (bare text) and the solid
           * CTA: a border is enough to set "Se connecter" apart without giving
           * it the weight of "Créer son programme".
           *
           * On a phone the label gives way to the icon alone: it is the
           * returning parents' action, they know it, and the 60 px reclaimed are
           * exactly what the CTA was short of. The circle is 44 px, so the
           * target stays compliant (ux-redesign §7).
           *
           * A person rather than a sign-in arrow: what the parent comes for is
           * their own space, not the act of authenticating. And the round
           * strokes extend the brand's blob where a tool icon would jar. The
           * exact meaning stays with the `aria-label`.
           */}
          <Link
            href="/login"
            aria-label="Se connecter"
            title="Se connecter"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm font-semibold whitespace-nowrap text-foreground transition-colors hover:bg-secondary sm:w-auto sm:px-3.5"
          >
            <UserRound aria-hidden className="size-5 sm:hidden" />
            <span className="hidden sm:inline">Se connecter</span>
          </Link>
          {/*
           * On a phone screen, "Créer son programme" breaks onto two lines and
           * crushes the rest of the bar: the short label takes over, the action
           * is the same.
           */}
          <Link
            href="/decouvrir"
            className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold whitespace-nowrap text-primary-foreground shadow-primary transition-transform hover:-translate-y-0.5 sm:px-5"
          >
            <span className="sm:hidden">Commencer</span>
            <span className="hidden sm:inline">Créer son programme</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-14 text-center md:px-8">
        <BrandMark />
        <p className="max-w-xl leading-relaxed text-muted-foreground">
          Conçu par une maman et un papa, pour leur merveilleux Mathis et pour
          tous les petits gourmets qui découvrent le monde.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-semibold">
          {[...METHOD_LINKS, { href: "/login", label: "Se connecter" }].map(
            (link, i) => (
              <span key={link.href} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden className="text-border">
                    ·
                  </span>
                )}
                <Link
                  href={link.href}
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {link.label}
                </Link>
              </span>
            ),
          )}
        </nav>
        {/*
         * The version, very small under the links: it is not information for the
         * parent, it is what we ask them to read back to us when they report
         * something. So it must be findable without ever drawing the eye.
         */}
        {APP_VERSION && (
          <p className="text-xs text-muted-foreground/70">
            Version {APP_VERSION}
          </p>
        )}
      </div>
    </footer>
  );
}
