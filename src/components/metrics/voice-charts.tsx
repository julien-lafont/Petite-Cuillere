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
 * Les deux courbes de `/mesures/voix`.
 *
 * Deux graphiques et non deux axes sur un seul : une latence en millisecondes et
 * un nombre de dictées n'ont pas d'échelle commune, et les superposer ferait
 * dire à la pente ce qu'on aurait choisi de lui faire dire.
 *
 * Le couple de couleurs n'est pas pris au hasard dans la palette : abricot et
 * bleu ardoise sont les deux seules teintes du jeu qui restent séparées pour un
 * œil protanope (ΔE 15) comme pour un œil ordinaire (ΔE 21) — le vert du reste
 * de l'application se confond avec l'abricot dès qu'on perd le rouge. Le p90
 * porte en plus un trait discontinu : la couleur ne doit jamais être le seul
 * moyen de distinguer deux courbes.
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

/** « 12 août », parce qu'une date ISO ne se lit pas d'un coup d'œil sur un axe. */
function dayLabel(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/** `unknown` parce que recharts ne promet rien du type qu'il passe au formateur. */
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
           * Le seuil de §3.4 : au-delà de cinq secondes, le parent aura fini de
           * taper avant que l'app réponde. C'est la seule ligne du graphique qui
           * ne soit pas une mesure, d'où le libellé — un trait rouge sans mot ne
           * dit pas ce qu'il tranche.
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
          {/* Une seule série : pas de légende, le titre du bloc la nomme. */}
          <Bar dataKey="runs" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
