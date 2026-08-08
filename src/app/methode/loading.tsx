import { METHOD_COLUMN } from "@/components/method-page";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Vaut pour les deux pages « La méthode » : leur coquille dépend du visiteur
 * (connecté ou non), donc le rendu est dynamique et sans ce fallback le clic
 * resterait sans effet le temps de la réponse.
 *
 * La largeur de colonne est reprise ici parce que les pages la posent
 * elles-mêmes, pas le layout — sans quoi le squelette s'étalerait sur toute la
 * largeur et le contenu sauterait en arrivant.
 */
export default function Loading() {
  return (
    <div className={`${METHOD_COLUMN} space-y-10`}>
      {/* Fil d'Ariane, surtitre, titre, chapô. */}
      <div className="space-y-5">
        <Skeleton className="h-4 w-44" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-12 w-full max-w-[22ch]" />
          <Skeleton className="h-12 w-2/3 max-w-[16ch]" />
          <Skeleton className="h-5 w-full" />
        </div>
      </div>

      {/* Les trois repères chiffrés. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      {/* Les règles numérotées. */}
      <div className="space-y-12">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <Skeleton className="h-8 w-72 max-w-full" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
