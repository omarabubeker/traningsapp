"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, GRID, TooltipBox } from "./ChartTooltip";

export type WeekPoint = { label: string; km: number; runs: number; current: boolean };

export function WeeklyVolumeChart({ data }: { data: WeekPoint[] }) {
  return (
    <div className="h-44 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barCategoryGap={2}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={8} />
          <YAxis {...AXIS} axisLine={false} allowDecimals={false} width={44} />
          <Tooltip
            cursor={{ fill: "var(--color-surface-2)" }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <TooltipBox
                  title={`Vecka ${String(payload[0].payload.label).slice(1)}`}
                  rows={[
                    { label: "Löpning", value: `${(payload[0].payload.km as number).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km`, color: "var(--color-run)" },
                    { label: "Pass", value: String(payload[0].payload.runs) },
                  ]}
                />
              ) : null
            }
          />
          <Bar
            dataKey="km"
            maxBarSize={22}
            radius={[4, 4, 0, 0]}
            fill="var(--color-run)"
            fillOpacity={0.9}
            isAnimationActive={false}
            shape={(props: unknown) => {
              const p = props as { x: number; y: number; width: number; height: number; payload: WeekPoint };
              const r = Math.min(4, p.height);
              const { x, y, width: w, height: h } = p;
              if (h <= 0) return <g />;
              return (
                <path
                  d={`M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`}
                  fill="var(--color-run)"
                  fillOpacity={p.payload.current ? 1 : 0.55}
                />
              );
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
