import { CoverageCard } from "@/components/stats/coverage-card";

export function FoodCoverageCard({
  introducedCount,
  totalCount,
}: {
  introducedCount: number;
  totalCount: number;
}) {
  return (
    <CoverageCard
      introducedCount={introducedCount}
      totalCount={totalCount}
      countLabel="aliments testés"
      href="/aliments"
      linkLabel="Voir le catalogue"
    />
  );
}
