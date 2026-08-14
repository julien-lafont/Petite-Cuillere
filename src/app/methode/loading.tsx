import { METHOD_COLUMN } from "@/components/method-page";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Covers both "La méthode" pages: their shell depends on the visitor (signed in
 * or not), so rendering is dynamic and without this fallback the click would do
 * nothing for the length of the response.
 *
 * The column width is repeated here because the pages set it themselves, not the
 * layout — otherwise the skeleton would spread full width and the content would
 * jump on arrival.
 */
export default function Loading() {
  return (
    <div className={`${METHOD_COLUMN} space-y-10`}>
      {/* Eyebrow, title, standfirst. */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="h-12 w-full max-w-[22ch]" />
        <Skeleton className="h-12 w-2/3 max-w-[16ch]" />
        <Skeleton className="h-5 w-full" />
      </div>

      {/* The three headline figures. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>

      {/* The numbered rules. */}
      <div className="space-y-12">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <Skeleton className="h-8 w-72 max-w-full" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
