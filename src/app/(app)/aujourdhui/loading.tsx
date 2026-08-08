import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, CardListSkeleton } from "@/components/skeletons";

/**
 * Sans ce fichier, la route étant dynamique, Next renonce à précharger quoi que
 * ce soit : le clic reste sans effet jusqu'à la réponse complète du serveur.
 * Avec lui, la coquille part en préchargement et la navigation est immédiate.
 */
export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton eyebrow />
      <CardListSkeleton count={3} className="h-40" />
      <section className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <CardListSkeleton count={2} className="h-24" />
      </section>
    </div>
  );
}
