import { Skeleton } from "@/components/ui/skeleton";

/**
 * The page is reached by a `<Link>` — from the children list and from the
 * switcher — and it reads the household catalogue, so it is rendered on demand.
 * Without this file Next would give up prefetching it and the tap on "Ajouter un
 * enfant" would do nothing visible until the full response.
 *
 * The skeleton reuses the onboarding's frame in "add" mode: brand and escape
 * hatch on one line, step gauge, then the questionnaire card. No navigation
 * shell — this page lives outside the `(app)` group, full screen.
 */
export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>

        {/* The gauge at its first step: the questionnaire opens on the first name. */}
        <div className="flex justify-center gap-1.5">
          <Skeleton className="h-1.5 w-6 rounded-full" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-1.5 w-1.5 rounded-full" />
          ))}
        </div>

        <div className="mt-6 space-y-4 rounded-lg border bg-card p-6 shadow-soft">
          <Skeleton className="h-6 w-56 max-w-full" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <Skeleton className="h-12 w-full rounded-md" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </main>
  );
}
