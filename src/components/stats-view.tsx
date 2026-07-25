"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toleranceInfo } from "@/lib/tolerance";
import { categoryMeta } from "@/lib/categories";
import {
  STATS_PERIODS,
  periodStartISO,
  firstExposureByFood,
  computeKpis,
  categoryBreakdown,
  acceptanceByCategory,
  topFoods,
  allergenCoverage,
  diversityOverTime,
  type StatsPeriod,
} from "@/lib/stats";
import type { MealWithDetails } from "@/lib/data/meals.types";
import { StatTile } from "@/components/stats/stat-tile";
import { CategoryDonut } from "@/components/stats/category-donut";
import { DiversityChart } from "@/components/stats/diversity-chart";
import { AcceptanceBars } from "@/components/stats/acceptance-bars";
import { TopFoods } from "@/components/stats/top-foods";
import { AllergenCoverageCard } from "@/components/stats/allergen-coverage-card";
import { FoodCoverageCard } from "@/components/stats/food-coverage-card";
import { EmptyStatsMessage } from "@/components/stats/empty-stats-message";

export function StatsView({
  meals,
  catalogSize,
  allergensCatalogSize,
  babyBirthISO,
  todayISO,
}: {
  meals: MealWithDetails[];
  catalogSize: number;
  allergensCatalogSize: number;
  babyBirthISO: string;
  todayISO: string;
}) {
  const [period, setPeriod] = useState<StatsPeriod>("30");

  const firstExposure = useMemo(() => firstExposureByFood(meals), [meals]);
  const start = periodStartISO(period, todayISO, babyBirthISO);
  const periodMeals = useMemo(
    () => meals.filter((m) => m.date >= start && m.date <= todayISO),
    [meals, start, todayISO],
  );

  const kpis = useMemo(
    () => computeKpis(periodMeals, firstExposure, start, catalogSize),
    [periodMeals, firstExposure, start, catalogSize],
  );
  const categories = useMemo(
    () => categoryBreakdown(periodMeals),
    [periodMeals],
  );
  const acceptance = useMemo(
    () => acceptanceByCategory(periodMeals),
    [periodMeals],
  );
  const { best, hardest } = useMemo(() => topFoods(periodMeals), [periodMeals]);
  const diversity = useMemo(
    () => diversityOverTime(firstExposure, start, todayISO),
    [firstExposure, start, todayISO],
  );
  const allergenCov = useMemo(
    () => allergenCoverage(meals, allergensCatalogSize),
    [meals, allergensCatalogSize],
  );

  const tol = toleranceInfo(kpis.acceptanceScore);

  function downloadCsv() {
    const cell = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const rows: string[][] = [
      ["Indicateur", "Valeur"],
      ["Repas notés", String(kpis.ratedMeals)],
      ["Aliments distincts", String(kpis.distinctFoods)],
      ["Nouveaux aliments", String(kpis.newFoods)],
      [
        "Appréciation moyenne",
        kpis.acceptanceScore != null ? `${kpis.acceptanceScore}%` : "",
      ],
      ["Effets indésirables", String(kpis.observations)],
      [],
      ["Catégorie", "Occurrences", "Part"],
      ...categories.map((c) => [
        categoryMeta(c.category).label,
        String(c.count),
        `${c.pct}%`,
      ]),
    ];
    const csv = rows.map((r) => r.map(cell).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stats-${period === "all" ? "tout" : `${period}j`}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (meals.length === 0) {
    return (
      <EmptyStatsMessage>
        Aucun repas noté pour l&apos;instant. Note les repas de bébé depuis
        l&apos;onglet Semaine pour voir les statistiques apparaître ici.
      </EmptyStatsMessage>
    );
  }

  return (
    <div className="space-y-8">
      {/* Contrôles */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          {STATS_PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                period === p.value
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={downloadCsv}
        >
          <Download className="size-4" />
          Exporter (CSV)
        </Button>
      </div>

      {periodMeals.length === 0 ? (
        <EmptyStatsMessage>
          Aucun repas noté sur cette période. Essaie une fenêtre plus large.
        </EmptyStatsMessage>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile label="Repas notés" value={String(kpis.ratedMeals)} />
            <StatTile
              label="Aliments distincts"
              value={String(kpis.distinctFoods)}
              sub={`sur ${kpis.catalogSize} au catalogue`}
            />
            <StatTile label="Nouveaux aliments" value={String(kpis.newFoods)} />
            <StatTile
              label="Appréciation"
              value={
                kpis.acceptanceScore != null ? `${kpis.acceptanceScore}%` : "—"
              }
              sub={tol?.label}
            />
            <StatTile
              label="Effets indésirables"
              value={String(kpis.observations)}
              tone={kpis.observations > 0 ? "danger" : "default"}
            />
          </div>

          {/* Répartition par catégorie */}
          <Card>
            <CardHeader>
              <CardTitle>Répartition par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryDonut data={categories} />
            </CardContent>
          </Card>

          {/* Diversité dans le temps */}
          <Card>
            <CardHeader>
              <CardTitle>Diversité alimentaire</CardTitle>
            </CardHeader>
            <CardContent>
              <DiversityChart data={diversity} />
            </CardContent>
          </Card>

          {/* Appréciation par catégorie */}
          <Card>
            <CardHeader>
              <CardTitle>Appréciation par catégorie</CardTitle>
            </CardHeader>
            <CardContent>
              <AcceptanceBars data={acceptance} />
            </CardContent>
          </Card>

          {/* Palmarès */}
          <Card>
            <CardHeader>
              <CardTitle>Palmarès des aliments</CardTitle>
            </CardHeader>
            <CardContent>
              <TopFoods best={best} hardest={hardest} />
            </CardContent>
          </Card>
        </>
      )}

      {/* Couverture aliments — toujours sur tout l'historique */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Couverture aliments
            <span className="text-xs font-normal text-muted-foreground">
              (depuis le début)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FoodCoverageCard
            introducedCount={firstExposure.size}
            totalCount={catalogSize}
          />
        </CardContent>
      </Card>

      {/* Couverture allergènes — toujours sur tout l'historique (sécurité) */}
      <Card
        className={
          allergenCov.observationsCount > 0
            ? "border-destructive/30 bg-destructive/[0.04]"
            : undefined
        }
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Couverture allergènes
            <span className="text-xs font-normal text-muted-foreground">
              (depuis le début)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AllergenCoverageCard data={allergenCov} />
        </CardContent>
      </Card>
    </div>
  );
}
