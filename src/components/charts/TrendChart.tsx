"use client";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
const dayFmt = new Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "short", timeZone: "Europe/Stockholm" });

/** En serie över tid: mjuk 2px-kurva med gradientyta, senaste punkten markerad, tooltip vid hovring. */
const FORMATS: Record<Props["unit"], (v: number) => string> = {
  pace: (v) => `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, "0")}`,
  bpm: (v) => `${Math.round(v)}`,
  kg: (v) => `${Math.round(v)} kg`,
  reps: (v) => `${Math.round(v)} st`,
};

export function TrendChart({ data, color, name, unit, invert = false, height = 176 }: Props) {
  const format = FORMATS[unit];
  const gid = `g${useId().replace(/:/g, "")}`;
  if (data.length < 2) return <p className="py-6 text-center text-sm text-muted-foreground">För lite data än.</p>;
  const values = data.map((d) => d.value);
  // Jämna skalsteg: 30 s / 1 min för tempo, 10/20 för puls, 5/10/20 för kg.
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const step =
    unit === "pace" ? (span > 150 ? 60 : 30) : unit === "bpm" ? (span > 60 ? 20 : 10) : span > 80 ? 20 : span > 30 ? 10 : 5;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step + (Math.ceil(max / step) * step === max ? step : 0);
  // En etikett per månad (den 1:a), i stället för upprepade månadsnamn.
  const [t0, t1] = [data[0].t, data[data.length - 1].t];
  const monthTicks: number[] = [];
  for (let d = new Date(t0); d.getTime() <= t1; d.setMonth(d.getMonth() + 1)) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    if (first >= t0) monthTicks.push(first);
  }
  const byMonth = monthTicks.length >= 2;
  // Kort period: tre datum (start, mitt, slut) i stället för månader.
  const xTicks = byMonth ? (monthTicks.length > 5 ? monthTicks.filter((_, i) => i % 2 === 0) : monthTicks) : [t0, Math.round((t0 + t1) / 2), t1];
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: byMonth ? 10 : 20, bottom: 0, left: -6 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            {...AXIS}
            tickFormatter={(t) => (byMonth ? monthFmt : dayFmt).format(new Date(t)).replace(".", "")}
            ticks={xTicks}
            interval={0}
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
            cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as TrendPoint | undefined) : undefined;
              return p ? (
                <TooltipBox title={p.label} rows={[{ label: name, value: format(p.value), color }, ...(p.detail ? [{ label: "", value: p.detail }] : [])]} />
              ) : null;
            }}
          />
          <Area
            dataKey="value"
            type="monotone"
            baseValue={invert ? hi : lo}
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={`url(#${gid})`}
            dot={(p: { cx?: number; cy?: number; index?: number }) =>
              p.index === data.length - 1 && p.cx != null && p.cy != null ? (
                <g key="last">
                  <circle cx={p.cx} cy={p.cy} r={8} fill={color} fillOpacity={0.2} />
                  <circle cx={p.cx} cy={p.cy} r={4.5} fill={color} stroke="var(--color-surface)" strokeWidth={2} />
                </g>
              ) : (
                <g key={p.index} />
              )
            }
            activeDot={{ r: 6, fill: color, stroke: "var(--color-surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
