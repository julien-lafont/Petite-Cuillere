import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      {/* Navigation entre semaines */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="size-10 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="size-10 rounded-full" />
      </div>
      {/* Grille des sept jours */}
      <div className="space-y-3">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
