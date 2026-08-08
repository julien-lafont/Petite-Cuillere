import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      {/* Graphiques */}
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
