import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons";

/**
 * La coquille de `/mesures`. Elle existe pour les liens de période, qui sont des
 * `<Link>` internes vers une route rendue à la demande : sans ce fichier, Next
 * ne préchargerait rien et changer de période ne montrerait rien pendant tout
 * l'aller-retour.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-5 py-10 sm:px-8">
      <PageHeaderSkeleton />
      <Skeleton className="h-9 w-56 rounded-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}
