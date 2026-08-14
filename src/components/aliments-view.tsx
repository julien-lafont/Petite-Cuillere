"use client";

import { useState } from "react";
import {
  LayoutGrid,
  Table2,
  Download,
  ShieldAlert,
  AlertTriangle,
  Leaf,
  Snowflake,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toleranceInfo } from "@/lib/tolerance";
import { CATEGORY_ORDER, categoryMeta } from "@/lib/categories";
import { FoodFormDialog } from "@/components/food-form-dialog";
import type { AllergenRow } from "@/lib/data/allergens";

export type AlimentStatus = "introduit" | "maintenant" | "avenir";
export type AlimentRow = {
  id: string;
  name: string;
  category: string | null;
  ageMin: number | null;
  isAllergen: boolean;
  texture: string | null;
  preparation: string | null;
  quantite: string | null;
  restrictions: string | null;
  hasSeason: boolean;
  seasonLabel: string;
  inSeason: boolean;
  status: AlimentStatus;
  exposures: number;
  score: number | null;
};

const STATUS_META: Record<AlimentStatus, { label: string }> = {
  introduit: { label: "Déjà introduits" },
  maintenant: { label: "À proposer maintenant" },
  avenir: { label: "À venir" },
};
const STATUS_ORDER: AlimentStatus[] = ["introduit", "maintenant", "avenir"];

function ageLabel(ageMin: number | null) {
  return ageMin != null ? `dès ${ageMin} mois` : "";
}

function FoodGridCard({ r }: { r: AlimentRow }) {
  const tol = toleranceInfo(r.score);
  return (
    <div
      className={cn(
        "space-y-1.5 rounded-xl border bg-card p-4",
        r.status === "avenir" && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-heading font-bold">{r.name}</p>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {r.ageMin != null && (
            <Badge variant="secondary" className="font-normal">
              {ageLabel(r.ageMin)}
            </Badge>
          )}
          {r.isAllergen && (
            <Badge
              variant="outline"
              className="gap-1 border-chart-3/40 bg-chart-3/15 text-amber-700"
            >
              <ShieldAlert className="size-3" />
              allergène
            </Badge>
          )}
        </div>
      </div>

      {r.status === "introduit" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">
            {r.exposures}× introduit{r.exposures > 1 ? "s" : ""}
          </Badge>
          {tol && (
            <Badge variant="outline" className={cn("gap-1", tol.cls)}>
              {tol.emoji} {tol.label}
              {r.score != null ? ` · ${r.score}%` : ""}
            </Badge>
          )}
        </div>
      )}

      {r.texture && (
        <p className="text-xs font-medium text-muted-foreground">
          Texture : {r.texture}
        </p>
      )}
      {r.preparation && (
        <p className="text-sm text-muted-foreground">{r.preparation}</p>
      )}
      {r.quantite && (
        <p className="text-xs text-muted-foreground">
          Quantité indicative : {r.quantite}
        </p>
      )}
      {r.restrictions && (
        <p className="flex items-start gap-1.5 rounded-lg bg-destructive/8 px-2.5 py-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {r.restrictions}
        </p>
      )}
      {r.hasSeason && (
        <p
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            r.inSeason ? "text-primary" : "text-sky-700",
          )}
        >
          {r.inSeason ? (
            <Leaf className="size-3.5" />
          ) : (
            <Snowflake className="size-3.5" />
          )}
          {r.inSeason ? "De saison" : "Hors saison"} · {r.seasonLabel}
        </p>
      )}
    </div>
  );
}

export function AlimentsView({
  rows,
  allergens,
}: {
  rows: AlimentRow[];
  allergens: AllergenRow[];
}) {
  const [view, setView] = useState<"grid" | "table">("grid");

  function downloadCsv() {
    const headers = [
      "Nom",
      "Type",
      "Fenêtre",
      "Statut",
      "Saison",
      "Saisonnalité",
      "Expositions",
      "Score",
    ];
    const cell = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((r) =>
      [
        r.name,
        categoryMeta(r.category).label,
        ageLabel(r.ageMin),
        STATUS_META[r.status].label,
        r.seasonLabel,
        r.hasSeason ? (r.inSeason ? "De saison" : "Hors saison") : "",
        String(r.exposures),
        r.score != null ? `${r.score}%` : "",
      ]
        .map(cell)
        .join(";"),
    );
    const csv = [headers.map(cell).join(";"), ...lines].join("\r\n");
    const blob = new Blob(["﻿" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aliments.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border p-0.5">
          <button
            onClick={() => setView("grid")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "grid"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-4" />
            Grille
          </button>
          <button
            onClick={() => setView("table")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "table"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Table2 className="size-4" />
            Tableau
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={downloadCsv}
          >
            <Download className="size-4" />
            Exporter (CSV)
          </Button>
          <FoodFormDialog allergens={allergens} />
        </div>
      </div>

      {view === "grid" ? <GridView rows={rows} /> : <TableView rows={rows} />}
    </div>
  );
}

function GridView({ rows }: { rows: AlimentRow[] }) {
  return (
    <div className="space-y-8">
      {STATUS_ORDER.map((status) => {
        const inStatus = rows.filter((r) => r.status === status);
        if (inStatus.length === 0) return null;
        const groups = CATEGORY_ORDER.map((cat) => ({
          cat,
          meta: categoryMeta(cat),
          items: inStatus.filter((r) => (r.category ?? "autre") === cat),
        })).filter((g) => g.items.length > 0);

        return (
          <section key={status} className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-lg font-bold">
                {STATUS_META[status].label}
              </h2>
              <Badge variant="secondary">{inStatus.length}</Badge>
            </div>
            <div className="space-y-6">
              {groups.map((g) => (
                <div key={g.cat} className="space-y-3">
                  <h3 className="font-heading text-sm font-bold text-muted-foreground">
                    {g.meta.emoji} {g.meta.label}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((r) => (
                      <FoodGridCard key={r.id} r={r} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TableView({ rows }: { rows: AlimentRow[] }) {
  const ordered = [...rows].sort(
    (a, b) =>
      STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
      (a.category ?? "").localeCompare(b.category ?? "") ||
      a.name.localeCompare(b.name),
  );
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Nom</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Fenêtre</th>
            <th className="px-3 py-2 font-medium">Statut</th>
            <th className="px-3 py-2 font-medium">Saison</th>
            <th className="px-3 py-2 font-medium">Saisonnalité</th>
            <th className="px-3 py-2 text-right font-medium">Expo.</th>
            <th className="px-3 py-2 font-medium">Score</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {ordered.map((r) => {
            const tol = toleranceInfo(r.score);
            const cm = categoryMeta(r.category);
            return (
              <tr key={r.id} className="hover:bg-accent/20">
                <td className="px-3 py-2 font-medium">
                  {r.name}
                  {r.isAllergen && (
                    <ShieldAlert className="ml-1 inline size-3 text-amber-600" />
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {cm.emoji} {cm.label}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {ageLabel(r.ageMin) || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {STATUS_META[r.status].label}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {r.seasonLabel || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {r.hasSeason ? (
                    <span
                      className={cn(
                        "text-xs font-medium",
                        r.inSeason ? "text-primary" : "text-sky-700",
                      )}
                    >
                      {r.inSeason ? "De saison" : "Hors saison"}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.exposures || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  {tol ? (
                    <span>
                      {tol.emoji} {r.score}%
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
