/**
 * Marque « Petite Cuillère » : le symbole des premiers repas.
 * Dessin maison plutôt qu'une icône de bibliothèque — c'est l'élément
 * d'identité, il ne doit ressembler à aucun autre produit.
 */
export function SpoonIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <ellipse cx="12" cy="7.2" rx="4.4" ry="5.2" fill="currentColor" />
      <path
        d="M12 12.4v8.4"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Le pictogramme n'est pas un carré arrondi de plus : c'est une tache — la
 * forme signature de la marque (cf. `blob` dans globals.css). Fond abricot,
 * cuillère en brun profond : le seul endroit de l'interface où l'accent chaud
 * porte le symbole plutôt que de le décorer.
 */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="blob grid size-10 shrink-0 place-items-center bg-apricot text-apricot-foreground">
        <SpoonIcon className="size-5" />
      </div>
      {/*
       * Le nom se tronque plutôt que de déborder : sur un écran étroit, la
       * tache seule identifie déjà la marque, alors qu'une barre qui dépasse
       * fait défiler toute la page de travers.
       */}
      {!compact && (
        <p className="truncate font-heading text-base leading-tight font-bold sm:text-lg">
          Petite Cuillère
        </p>
      )}
    </div>
  );
}
