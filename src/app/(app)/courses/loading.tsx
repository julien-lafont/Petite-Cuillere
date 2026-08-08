import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton, RowListSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {/* Bascule semaine / mois */}
      <Skeleton className="h-12 w-full rounded-lg" />
      <RowListSkeleton count={7} />
    </div>
  );
}
