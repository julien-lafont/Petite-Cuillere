"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DiversityPoint } from "@/lib/stats";
import { EmptyStatsMessage } from "@/components/stats/empty-stats-message";

export function DiversityChart({ data }: { data: DiversityPoint[] }) {
  const hasData = data.some((d) => d.cumulativeFoods > 0);
  if (!hasData) {
    return (
      <EmptyStatsMessage>
        Pas encore d&apos;aliment introduit sur cette période.
      </EmptyStatsMessage>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ left: -20, right: 8, top: 8, bottom: 0 }}
        >
          <defs>
            <linearGradient id="diversityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop
                offset="95%"
                stopColor="var(--chart-1)"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={28}
            allowDecimals={false}
          />
          <Tooltip
            formatter={(value) => [`${value} aliments`, "Cumul"]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulativeFoods"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#diversityFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
