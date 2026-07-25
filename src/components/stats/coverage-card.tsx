import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Jauge introduit/total + lien de détail — modèle partagé (aliments, allergènes…). */
export function CoverageCard({
  introducedCount,
  totalCount,
  countLabel,
  href,
  linkLabel,
  children,
}: {
  introducedCount: number;
  totalCount: number;
  countLabel: string;
  href: string;
  linkLabel: string;
  children?: React.ReactNode;
}) {
  const pct =
    totalCount > 0 ? Math.round((introducedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">
          {introducedCount} / {totalCount} {countLabel}
        </span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
      </div>
      {children}
      <Link
        href={href}
        className="flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {linkLabel}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
