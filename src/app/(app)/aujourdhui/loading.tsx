import { Skeleton } from "@/components/ui/skeleton";
import {
  PageHeaderSkeleton,
  CardSkeleton,
  CardListSkeleton,
  RowListSkeleton,
} from "@/components/skeletons";

/**
 * Without this file, the route being dynamic, Next gives up prefetching
 * anything: the click does nothing until the server's full response. With it,
 * the shell is prefetched and navigation is instant.
 */
export default function Loading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton eyebrow />
      {/* The shape of the thread: meals already filled in as rows, the
          current meal's card unfolded, the next ones as rows again. */}
      <div className="space-y-3">
        <RowListSkeleton count={1} />
        <CardSkeleton className="h-72" />
        <RowListSkeleton count={2} />
      </div>
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
