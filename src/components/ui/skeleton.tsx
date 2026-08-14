import { cn } from "@/lib/utils";

/**
 * Placeholder block shown while a page loads. Deliberately quiet: `--muted` on
 * the milk background, no border — it announces a shape to come, it does not
 * offer itself to be read.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}
