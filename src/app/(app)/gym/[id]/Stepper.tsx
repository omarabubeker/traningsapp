"use client";
import { useState } from "react";

type Props = {
  label: string;
  value: number;
  step: number;
  min?: number;
  decimals?: boolean;
  onChange: (n: number) => void;
};

export function Stepper({ label, value, step, min = 0, decimals = false, onChange }: Props) {
  // Text som skrivs just nu; null = visa aktuellt värde.
  const [text, setText] = useState<string | null>(null);

  function commit(raw: string) {
    setText(null);
    const n = Number(raw.replace(",", ".").replace(/[^\d.]/g, ""));
    if (raw.trim() !== "" && Number.isFinite(n)) onChange(Math.max(min, decimals ? Math.round(n * 4) / 4 : Math.round(n)));
  }
  const bump = (d: number) => onChange(Math.max(min, Math.round((value + d) * 100) / 100));

  return (
    <div>
      <p className="mb-1 text-center text-xs text-muted-foreground">{label}</p>
      <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-surface-2">
        <button type="button" onClick={() => bump(-step)} className="w-12 text-2xl text-muted-foreground active:bg-line" aria-label={`Minska ${label}`}>−</button>
        <input
          value={text ?? fmt(value)}
          inputMode={decimals ? "decimal" : "numeric"}
          onChange={(e) => setText(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onFocus={(e) => {
            setText(fmt(value));
            requestAnimationFrame(() => e.target.select());
          }}
          className="min-w-0 flex-1 bg-transparent py-3 text-center text-2xl font-semibold tabular-nums outline-none"
          aria-label={label}
        />
        <button type="button" onClick={() => bump(step)} className="w-12 text-2xl text-muted-foreground active:bg-line" aria-label={`Öka ${label}`}>+</button>
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n.toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}
