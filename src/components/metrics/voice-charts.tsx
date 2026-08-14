"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VoiceDailyPoint } from "@/lib/data/voice-traces";

/**
 * The two charts on `/mesures/voix`.
 *
 * Two charts and not two axes on one: a latency in milliseconds and a count of
 * dictations share no scale, and overlaying them would make the slope say
 * whatever we chose to make it say.
 *
 * The colour pair is not picked at random from the palette: apricot and slate
 * blue are the only two hues in the set that stay separate to a protanopic eye
 * (ΔE 15) as well as an ordinary one (ΔE 21) — the green used across the rest of
 * the app merges with apricot as soon as red is lost. The p90 also carries a
 * dashed stroke: colour must never be the only way to tell two lines apart.
 */

const AXIS = {
  tick: { fontSize: 11, fill: "var(--muted-foreground)" },
  axisLine: false,
  tickLine: false,
} as const;

const TOOLTIP = {
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  fontSize: 12,
} as const;

/** "12 août", because an ISO date is not readable at a glance on an axis. */
function dayLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** `unknown` because recharts promises nothing about what it passes the formatter. */
function seconds(ms: unknown) {
  return typeof ms === "number" ? `${(ms / 1000).toFixed(1)} s` : "—";
}

export function VoiceLatencyChart({ data }: { data: VoiceDailyPoint[] }) {
  const points = data.map((point) => ({
    ...point,
    label: dayLabel(point.day),
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ left: -8, right: 8, top: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis dataKey="label" minTickGap={24} {...AXIS} />
          <YAxis
            width={44}
            tickFormatter={(value: number) => `${value / 1000}s`}
            {...AXIS}
          />
          {/*
           * The §3.4 threshold: past five seconds, the parent will have finished
           * typing before the app answers. It is the only line on the chart that
           * is not a measurement, hence the label — a red rule with no words does
           * not say what it cuts.
           */}
          <ReferenceLine
            y={5000}
            stroke="var(--destructive)"
            strokeDasharray="4 4"
            label={{
              value: "budget 5 s",
              position: "insideTopRight",
              fill: "var(--destructive)",
              fontSize: 11,
            }}
          />
          <Tooltip
            contentStyle={TOOLTIP}
            formatter={(value, name) => [seconds(value), name]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            name="Médiane ressentie"
            type="monotone"
            dataKey="p50_perceived"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
          <Line
            name="p90 ressenti"
            type="monotone"
            dataKey="p90_perceived"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function VoiceUsageChart({ data }: { data: VoiceDailyPoint[] }) {
  const points = data.map((point) => ({
    ...point,
    label: dayLabel(point.day),
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ left: -20, right: 8, top: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis dataKey="label" minTickGap={24} {...AXIS} />
          <YAxis width={28} allowDecimals={false} {...AXIS} />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            contentStyle={TOOLTIP}
            formatter={(value) => [`${value}`, "Dictées"]}
          />
          {/* A single series: no legend, the block's title names it. */}
          <Bar dataKey="runs" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
