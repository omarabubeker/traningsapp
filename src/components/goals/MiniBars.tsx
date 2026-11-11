/** Små staplar som i Hälsa: grå, den markerade (t.ex. idag) i färg. */
export function MiniBars({ values, highlight, color = "var(--color-run)", labels }: { values: number[]; highlight: number; color?: string; labels?: string[] }) {
  const max = Math.max(...values, 0.0001);
  return (
    <div className="space-y-1" aria-hidden>
      <div className="flex h-10 items-end gap-1">
        {values.map((v, i) => (
          <span
            key={i}
            className="flex-1 rounded-[3px]"
            style={{
              height: v > 0 ? `${Math.max(12, (v / max) * 100)}%` : "3px",
              background: i === highlight ? color : "var(--color-muted-foreground)",
              opacity: i === highlight ? 1 : v > 0 ? 0.3 : 0.15,
            }}
          />
        ))}
      </div>
      {labels && (
        <div className="flex gap-1 text-center text-[10px] font-semibold text-muted-foreground">
          {labels.map((l, i) => (
            <span key={i} className={`flex-1 ${i === highlight ? "text-foreground" : ""}`}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}
