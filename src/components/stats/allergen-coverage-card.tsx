import { AlertTriangle } from "lucide-react";
import { CoverageCard } from "@/components/stats/coverage-card";
import type { AllergenCoverage } from "@/lib/stats";

export function AllergenCoverageCard({ data }: { data: AllergenCoverage }) {
  return (
    <CoverageCard
      introducedCount={data.introducedCount}
      totalCount={data.totalCount}
      countLabel="allergènes introduits"
      href="/allergenes"
      linkLabel="Voir le détail"
    >
      {data.observationsCount > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {data.observationsCount} effet{data.observationsCount > 1 ? "s" : ""} indésirable
          {data.observationsCount > 1 ? "s" : ""} observé{data.observationsCount > 1 ? "s" : ""} depuis le
          début
        </p>
      )}
    </CoverageCard>
  );
}
