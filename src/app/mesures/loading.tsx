import { Skeleton } from "@/components/ui/skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons";

/**
 * The shell for `/mesures`. It exists for the period links, which are internal
 * `<Link>`s to a route rendered on demand: without this file Next would prefetch
 * nothing and switching period would show nothing for the whole round trip.
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
