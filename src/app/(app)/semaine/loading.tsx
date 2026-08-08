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

      {/* Sous xl : le ruban des sept jours, puis les repas de la journée. */}
      <div className="space-y-4 xl:hidden">
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-15 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-7 w-44" />
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>

      {/* À partir de xl : la grille de la semaine. */}
      <div className="hidden space-y-3 xl:block">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
