"use client";

// Gemensam tooltip för graferna: text i textfärger, färgad markör bredvid.
export function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-xs text-muted">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2">
          {r.color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span className="text-muted">{r.label}</span>
          <span className="ml-auto font-medium tabular-nums">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export const AXIS = { stroke: "var(--color-line)", tick: { fill: "var(--color-muted)", fontSize: 11 }, tickLine: false };
export const GRID = { stroke: "var(--color-line)", strokeDasharray: undefined, vertical: false } as const;
