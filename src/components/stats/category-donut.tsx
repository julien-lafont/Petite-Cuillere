"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { categoryMeta } from "@/lib/categories";
import type { CategoryCount } from "@/lib/stats";
import { EmptyStatsMessage } from "@/components/stats/empty-stats-message";

export function CategoryDonut({ data }: { data: CategoryCount[] }) {
  if (data.length === 0) {
    return <EmptyStatsMessage>Aucun aliment servi sur cette période.</EmptyStatsMessage>;
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="mx-auto h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="category"
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.category} fill={categoryMeta(d.category).chartVar} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, _name, entry) => {
                const payload = entry?.payload as CategoryCount | undefined;
                return [`${value} · ${payload?.pct ?? 0}%`, categoryMeta(payload?.category ?? null).label];
              }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--popover)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex-1 space-y-1.5">
        {data.map((d) => {
          const meta = categoryMeta(d.category);
          return (
            <li key={d.category} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: meta.chartVar }}
              />
              <span className="flex-1">
                {meta.emoji} {meta.label}
              </span>
              <span className="text-muted-foreground">
                {d.count} · {d.pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
