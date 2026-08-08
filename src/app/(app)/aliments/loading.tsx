import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, RowListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {/* Recherche + filtres par statut */}
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <RowListSkeleton count={8} />
    </div>
  );
}
