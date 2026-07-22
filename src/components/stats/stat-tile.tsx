import { cn } from "@/lib/utils";

export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        tone === "danger" && "border-destructive/30 bg-destructive/[0.04]",
      )}
    >
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-heading text-2xl font-extrabold tracking-tight",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
