import Link from "next/link";
import { Heart } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

/**
 * En-tête et pied de page des écrans publics : la landing (`app/page.tsx`) et
 * les pages « La méthode », ouvertes sans compte pour qu'on puisse vérifier ce
 * qu'on nous promet avant de s'inscrire.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
        <BrandMark />
        <Link
          href="/login"
          className="rounded-md px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
        >
          Se connecter
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center md:px-8">
        <BrandMark />
        <p className="flex max-w-xl items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <Heart aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
          Conçu par une maman et un papa, pour leur merveilleux Mathis et pour
          tous les petits gourmets qui découvrent le monde.
        </p>
      </div>
    </footer>
  );
}
