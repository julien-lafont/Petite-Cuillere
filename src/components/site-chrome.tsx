import Link from "next/link";
import { UserRound } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { ALLERGENES_URL, METHODE_URL } from "@/lib/routes";

/**
 * En-tête et pied de page des écrans publics : la landing (`app/page.tsx`) et
 * les pages « La méthode », ouvertes sans compte pour qu'on puisse vérifier ce
 * qu'on nous promet avant de s'inscrire.
 */

/**
 * Les deux pages de méthode, publiques, citées à l'identique en haut et en bas.
 *
 * Ce sont les versions prérendues : ce sont elles qui s'ouvrent sans
 * aller-retour serveur, et les seules indexées. Les routes `/methode…` servent
 * le même texte aux lecteurs connectés, dans la coquille de l'app.
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
         * La marque cède avant la barre : `min-w-0` l'autorise à rétrécir et le
         * nom se tronque plutôt que de pousser les boutons hors de l'écran. Sans
         * ça, un `shrink-0` de chaque côté ne laisse aucune issue au navigateur
         * — c'est exactement ce qui débordait de 63 px sur un écran de 375 px.
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
           * Les deux pages de méthode sortent de la barre en dessous de 768 px :
           * elles se retrouvent en pied de page, et le pouce garde une cible
           * unique. « Se connecter » reste, lui, toujours atteignable — c'est
           * l'entrée des parents qui reviennent.
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
           * Palier intermédiaire entre les liens de méthode (texte nu) et le
           * CTA plein : une bordure suffit à distinguer « Se connecter » sans
           * lui donner le même poids que « Créer son programme ».
           *
           * Sur un téléphone, le libellé cède la place à la seule icône : c'est
           * l'action des parents qui reviennent, ils la connaissent, et les
           * 60 px récupérés sont précisément ceux qui manquaient au CTA. Le
           * cercle fait 44 px, la cible reste conforme (ux-redesign §7).
           *
           * Un bonhomme plutôt qu'une flèche de connexion : ce que le parent
           * vient chercher, c'est son espace, pas l'acte de s'authentifier. Et
           * les traits ronds prolongent la tache de la marque là où une icône
           * d'outil jurerait. Le sens exact reste porté par l'`aria-label`.
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
           * Sur un écran de téléphone, « Créer son programme » se casse en deux
           * lignes et écrase le reste de la barre : le libellé court prend le
           * relais, l'action est la même.
           */}
          <Link
            href="/decouvrir"
            className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold whitespace-nowrap text-primary-foreground shadow-[0_6px_18px_-6px_var(--primary)] transition-transform hover:-translate-y-0.5 sm:px-5"
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
      </div>
    </footer>
  );
}
