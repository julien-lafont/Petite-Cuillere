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

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground shadow-soft">
        <SpoonIcon className="size-5" />
      </div>
      {!compact && (
        <p className="font-heading text-lg leading-tight font-semibold tracking-tight">
          Petite Cuillère
        </p>
      )}
    </div>
  );
}
