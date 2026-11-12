"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDate, formatKg, isoDay } from "@/lib/dates";
import type { WeightEntry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmDialog } from "@/components/ConfirmDialog";
import { monotonePath } from "@/lib/svgPath";

export function WeightLog({ initial }: { initial: WeightEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const router = useRouter();
  const [value, setValue] = useState("");
  const [date, setDate] = useState(isoDay());
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const latest = entries[0];

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const kg = Number(value.replace(",", "."));
    if (!kg) return;
    const { data, error } = await supabaseBrowser()
      .from("weight_entries")
      .upsert({ measured_on: date, weight_kg: kg }, { onConflict: "user_id,measured_on" })
      .select("id, measured_on, weight_kg")
      .single();
    if (error) return setError("Kunde inte spara vikten.");
    setError(null);
    setValue("");
    setEntries((xs) => [data, ...xs.filter((x) => x.measured_on !== data.measured_on)].sort((a, b) => b.measured_on.localeCompare(a.measured_on)));
    router.refresh();
  }

  async function remove(id: string) {
    if (!(await confirmDialog({ title: "Ta bort mätningen?", confirmLabel: "Ta bort", danger: true }))) return;
    const { error } = await supabaseBrowser().from("weight_entries").delete().eq("id", id);
    if (!error) {
      setEntries((xs) => xs.filter((x) => x.id !== id));
      router.refresh();
    }
  }

  return (
    <section className="card space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="h-card">Vikt</h2>
        {latest && <p className="text-2xl font-semibold">{formatKg(latest.weight_kg)} <span className="text-base text-muted-foreground">kg</span></p>}
      </div>
      <Sparkline entries={entries} />
      <form onSubmit={add} className="flex gap-2">
        <Input inputMode="decimal" placeholder="kg" className="w-20 shrink-0 px-3" value={value} onChange={(e) => setValue(e.target.value)} />
        <Input type="date" className="min-w-0 flex-1 px-3" value={date} max={isoDay()} onChange={(e) => setDate(e.target.value)} />
        <Button className="shrink-0 px-4">Spara</Button>
      </form>
      {error && <p className="text-sm text-danger">{error}</p>}
      {entries.length > 0 && (
        <ul className="divide-y divide-line text-sm">
          {(showAll ? entries : entries.slice(0, 5)).map((w) => (
            <li key={w.id} className="flex items-center justify-between py-2">
              <span className="text-muted-foreground inline-block first-letter:uppercase">{formatDate(w.measured_on + "T12:00:00Z", { day: "numeric", month: "short", year: "numeric" })}</span>
              <span className="flex items-center gap-3">
                {formatKg(w.weight_kg)} kg
                <button onClick={() => remove(w.id)} className="px-1 text-muted-foreground" aria-label="Ta bort">×</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {entries.length > 5 && (
        <button onClick={() => setShowAll(!showAll)} className="w-full text-sm text-muted-foreground">{showAll ? "Visa färre" : `Visa alla (${entries.length})`}</button>
      )}
    </section>
  );
}

function Sparkline({ entries }: { entries: WeightEntry[] }) {
  const pts = [...entries].reverse().slice(-30);
  if (pts.length < 2) return null;
  const vals = pts.map((p) => Number(p.weight_kg));
  const min = Math.min(...vals) - 0.5;
  const max = Math.max(...vals) + 0.5;
  const [w, h, pad] = [300, 64, 6];
  const xy = vals.map((v, i) => [pad + (i / (vals.length - 1)) * (w - 2 * pad), pad + (1 - (v - min) / (max - min)) * (h - 2 * pad)] as [number, number]);
  const line = monotonePath(xy);
  const [lx, ly] = xy.at(-1)!;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full overflow-visible" aria-label="Viktkurva">
      <defs>
        <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.28} />
          <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${lx},${h} L${xy[0][0]},${h} Z`} fill="url(#weight-fill)" />
      <path d={line} fill="none" stroke="var(--color-brand)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={4} fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth={2} />
    </svg>
  );
}
