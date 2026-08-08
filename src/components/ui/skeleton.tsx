import { cn } from "@/lib/utils";

/**
 * Bloc de remplacement affiché pendant qu'une page se charge. Volontairement
 * discret : `--muted` sur le lait, sans contour — il annonce une forme à venir,
 * il ne se donne pas à lire.
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
