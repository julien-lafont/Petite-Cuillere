"use client";

import { useLinkStatus } from "next/link";
import { cn } from "@/lib/utils";

/**
 * Pending marker to place **inside** a `<Link>`: it carries `data-pending` until
 * navigation completes.
 *
 * Two effects, deliberately offset in time:
 *
 *   0 ms    the link takes on its active look — that is the
 *           `has-[[data-pending]]` set on the parent link. The click is
 *           acknowledged at once, before the server has even answered.
 *   150 ms  this marker lights up and pulses. The delay stops it flashing for
 *           nothing when the page was prefetched and arrives immediately.
 *
 * The element always keeps its space (`visibility`, not `display`): its
 * appearance never shifts the label next to it.
 */
export function NavPending({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      data-pending={pending || undefined}
      className={cn("nav-hint", className)}
    />
  );
}
