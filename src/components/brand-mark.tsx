/**
 * The "Petite Cuillère" mark: the symbol of first meals.
 * Drawn in-house rather than taken from an icon library — it is the identity
 * element, it must look like no other product.
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
 * The mark is not one more rounded square: it is a blob — the brand's signature
 * shape (see `blob` in globals.css). Apricot background, deep brown spoon: the
 * one place in the interface where the warm accent carries the symbol rather
 * than decorating it.
 */
export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="blob grid size-10 shrink-0 place-items-center bg-apricot text-apricot-foreground">
        <SpoonIcon className="size-5" />
      </div>
      {/*
       * The name truncates rather than overflowing: on a narrow screen the blob
       * alone already identifies the brand, whereas a bar that sticks out sends
       * the whole page scrolling sideways.
       */}
      {!compact && (
        <p className="truncate font-heading text-base leading-tight font-bold sm:text-lg">
          Petite Cuillère
        </p>
      )}
    </div>
  );
}
