"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryMeta } from "@/lib/categories";
import type { AcceptanceByCategory } from "@/lib/stats";
import { EmptyStatsMessage } from "@/components/stats/empty-stats-message";

const RESULT_META = {
  bien: { label: "Adoré", color: "var(--primary)" },
  moyen: { label: "Moyen", color: "var(--chart-3)" },
  refuse: { label: "Refusé", color: "var(--destructive)" },
} as const;
const RESULT_KEYS = Object.keys(RESULT_META) as (keyof typeof RESULT_META)[];

export function AcceptanceBars({ data }: { data: AcceptanceByCategory[] }) {
  if (data.length === 0) {
    return (
      <EmptyStatsMessage>
        Aucun repas évalué sur cette période.
      </EmptyStatsMessage>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: `${categoryMeta(d.category).emoji} ${categoryMeta(d.category).label}`,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 8, right: 16, top: 8, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            horizontal={false}
          />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tick={{ fontSize: 12, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(value) =>
              RESULT_META[value as keyof typeof RESULT_META]?.label ?? value
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          {RESULT_KEYS.map((key) => (
            <Bar
              key={key}
              dataKey={key}
              name={key}
              stackId="result"
              fill={RESULT_META[key].color}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
