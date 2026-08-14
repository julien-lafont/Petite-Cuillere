import type { LucideIcon } from "lucide-react";

/** Holding screen for sections not built yet. */
export function ComingSoon({
  icon: Icon,
  title,
  description,
  iteration,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  iteration: string;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="size-8" />
      </div>
      <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
      <span className="mt-4 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        Prévu à l'itération {iteration}
      </span>
    </div>
  );
}
