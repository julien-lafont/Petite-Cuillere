import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Shapes shared by the loading screens (`loading.tsx`).
 *
 * Their job is not to imitate the page pixel for pixel, but to hold the same
 * frame — title, then blocks — so the real content arriving shifts nothing under
 * the parent's eyes.
 */

/** Page header: optional eyebrow, title, subtitle. */
export function PageHeaderSkeleton({ eyebrow = false }: { eyebrow?: boolean }) {
  return (
    <div className="space-y-2">
      {eyebrow && <Skeleton className="h-4 w-40" />}
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-5 w-80 max-w-full" />
    </div>
  );
}

/** A full card, at the given height. */
export function CardSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-32 w-full rounded-xl", className)} />;
}

/** A stack of `count` cards of the same height. */
export function CardListSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} className={className} />
      ))}
    </div>
  );
}

/** List rows (foods, shopping): badge plus label. */
export function RowListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl border p-4">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
