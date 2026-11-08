"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, TooltipBox } from "./ChartTooltip";

export type TrendPoint = { t: number; value: number; label: string; detail?: string };

type Props = {
  data: TrendPoint[];
  color: string;
  name: string;
  /** Formatnamn (funktioner kan inte skickas från serverkomponenter). */
  unit: "pace" | "bpm" | "kg" | "reps";
  /** true = lägre värde är bättre och ritas högre upp (t.ex. tempo). */
  invert?: boolean;
  height?: number;
};

const monthFmt = new Intl.DateTimeFormat("sv-SE", { month: "short", timeZone: "Europe/Stockholm" });

/** En serie över tid: 2px linje, punkter med ring i ytfärgen, tooltip vid hovring. */
const FORMATS: Record<Props["unit"], (v: number) => string> = {
  pace: (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`,
  bpm: (v) => `${Math.round(v)}`,
  kg: (v) => `${Math.round(v)} kg`,
  reps: (v) => `${Math.round(v)} st`,
};

export function TrendChart({ data, color, name, unit, invert = false, height = 176 }: Props) {
  const format = FORMATS[unit];
  if (data.length < 2) return <p className="py-6 text-center text-sm text-muted">För lite data än.</p>;
  const values = data.map((d) => d.value);
  // Jämna skalsteg: 30 s / 1 min för tempo, 10/20 för puls, 5/10/20 för kg.
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const step =
    unit === "pace" ? (span > 150 ? 60 : 30) : unit === "bpm" ? (span > 60 ? 20 : 10) : span > 80 ? 20 : span > 30 ? 10 : 5;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step + (Math.ceil(max / step) * step === max ? step : 0);
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            {...AXIS}
            tickFormatter={(t) => monthFmt.format(new Date(t)).replace(".", "")}
            minTickGap={24}
          />
          <YAxis
            {...AXIS}
            axisLine={false}
            reversed={invert}
            domain={[lo, hi]}
            ticks={ticks.length > 6 ? ticks.filter((_, i) => i % 2 === 0) : ticks}
            tickFormatter={unit === "kg" || unit === "reps" ? (v: number) => `${Math.round(v)}` : format}
            width={unit === "pace" ? 48 : 40}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-muted)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as TrendPoint | undefined) : undefined;
              return p ? (
                <TooltipBox title={p.label} rows={[{ label: name, value: format(p.value), color }, ...(p.detail ? [{ label: "", value: p.detail }] : [])]} />
              ) : null;
            }}
          />
          <Line
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            dot={{ r: 3.5, fill: color, stroke: "var(--color-surface)", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: color, stroke: "var(--color-surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
