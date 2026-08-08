import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Formes communes aux écrans de chargement (`loading.tsx`).
 *
 * Leur rôle n'est pas d'imiter la page au pixel près, mais de tenir la même
 * charpente — titre, puis blocs — pour que l'arrivée du contenu réel ne
 * déplace rien sous les yeux du parent.
 */

/** En-tête de page : surtitre optionnel, titre, sous-titre. */
export function PageHeaderSkeleton({ eyebrow = false }: { eyebrow?: boolean }) {
  return (
    <div className="space-y-2">
      {eyebrow && <Skeleton className="h-4 w-40" />}
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-5 w-80 max-w-full" />
    </div>
  );
}

/** Carte pleine, à la hauteur indiquée. */
export function CardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-32 w-full rounded-xl", className)} />;
}

/** Empilement de `count` cartes de même hauteur. */
export function CardListSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} className={className} />
      ))}
    </div>
  );
}

/** Lignes d'une liste (aliments, courses) : pastille + libellé. */
export function RowListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
