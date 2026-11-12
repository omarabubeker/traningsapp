import { ChartLineUp, Gauge } from "@phosphor-icons/react/dist/ssr";
import { BigValue, CardHead, type Tone } from "@/components/CardParts";
import { TrendChart } from "@/components/charts/TrendChart";
import { formatTime } from "@/lib/goalDef";
import { formatDate } from "@/lib/dates";
import type { Prognos } from "@/lib/prognosData";

const t = (d: string) => Date.parse(d + "T12:00:00Z");
const short = (d: string) => formatDate(d + "T12:00:00Z", { day: "numeric", month: "short" });
const mins = (s: number) => Math.max(1, Math.round(Math.abs(s) / 60));

/** Loppprognos: förväntad tid på målets distans, trend och övriga distanser. */
export function PredictionCard({ p, targetTimeS }: { p: NonNullable<Prognos["prediction"]>; targetTimeS: number | null }) {
  const first = p.trend[0];
  const change = first && p.trend.length > 1 ? p.timeS - first.timeS : null;
  const gap = targetTimeS ? p.timeS - targetTimeS : null;
  return (
    <div className="card space-y-4">
      <CardHead icon={ChartLineUp} tone="run" title={`Prognos: ${p.label}`} right="senaste 8 veckorna" />
      <div className="space-y-1">
        <BigValue value={formatTime(p.timeS)} />
        {gap !== null && (
          <p className={`text-sm font-semibold ${gap <= 0 ? "text-brand" : "text-muted-foreground"}`}>
            {gap <= 0 ? `Under måltiden ${formatTime(targetTimeS!)} – snyggt!` : `${mins(gap)} min från måltiden ${formatTime(targetTimeS!)}`}
          </p>
        )}
        {change !== null && Math.abs(change) >= 30 && (
          <p className="text-sm text-muted-foreground">
            {change < 0 ? `${mins(change)} min snabbare` : `${mins(change)} min långsammare`} än för {p.trend.length - 1} veckor sedan
          </p>
        )}
      </div>
      {p.trend.length > 1 && (
        <TrendChart data={p.trend.map((x) => ({ t: t(x.day), value: x.timeS, label: short(x.day) }))} color="var(--color-run)" name="Prognos" unit="time" invert height={150} />
      )}
      <div className="grid grid-cols-3 gap-2">
        {p.others.map((o) => (
          <div key={o.label} className="rounded-2xl bg-secondary/60 px-3 py-2.5">
            <p className="num-lg text-[17px]">{o.timeS ? formatTime(o.timeS) : "–"}</p>
            <p className="text-xs font-semibold text-muted-foreground">{o.label}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Utgår från {p.from.label === "pass" ? `passet ${short(p.from.day)}` : `snabbaste ${p.from.label} ${short(p.from.day)}`} ({p.from.km.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km på {formatTime(p.from.timeS)}).
        Lugna pass ger en försiktig prognos – ett tempopass eller testlopp gör den skarpare. Löpband räknas bara om distansen är rättad.
      </p>
    </div>
  );
}

const ZONES = [
  { key: "high", label: "Hög", from: -45, to: -30, cls: "bg-danger" },
  { key: "building", label: "Bygger form", from: -30, to: -10, cls: "bg-gym" },
  { key: "balance", label: "Balans", from: -10, to: 5, cls: "bg-run" },
  { key: "fresh", label: "Utvilad", from: 5, to: 25, cls: "bg-primary" },
] as const;
const TONE: Record<string, Tone> = { high: "danger", building: "gym", balance: "run", fresh: "brand" };

/** Form: utvilad – i balans – bygger form – hög belastning, med kondition och trötthet. */
export function FormCard({ f }: { f: NonNullable<Prognos["form"]> }) {
  const lo = ZONES[0].from, hi = ZONES.at(-1)!.to;
  const pos = ((Math.min(hi, Math.max(lo, f.form)) - lo) / (hi - lo)) * 100;
  const change = Math.round(f.fitnessChange);
  return (
    <div className="card space-y-4">
      <CardHead icon={Gauge} tone={TONE[f.state.key]} title="Form" right={f.state.label} />
      <div className="space-y-1.5">
        <div className="relative">
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
            {ZONES.map((z) => (
              <span key={z.key} className={`${z.cls} ${z.key === f.state.key ? "" : "opacity-30"}`} style={{ width: `${((z.to - z.from) / (hi - lo)) * 100}%` }} />
            ))}
          </div>
          <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-foreground shadow" style={{ left: `${pos}%` }} aria-hidden />
        </div>
        <div className="flex text-center text-[11px] font-semibold text-muted-foreground">
          {ZONES.map((z) => (
            <span key={z.key} className={z.key === f.state.key ? "text-foreground" : ""} style={{ width: `${((z.to - z.from) / (hi - lo)) * 100}%` }}>
              {z.label}
            </span>
          ))}
        </div>
      </div>
      <p className="text-[15px]">{f.state.text}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-secondary/60 px-3 py-2.5">
          <p className="num-lg">{Math.round(f.fitness)}</p>
          <p className="text-xs font-semibold text-muted-foreground">
            kondition{change ? ` · ${change > 0 ? "+" : ""}${change} på 4 v` : ""}
          </p>
        </div>
        <div className="rounded-2xl bg-secondary/60 px-3 py-2.5">
          <p className="num-lg">{Math.round(f.fatigue)}</p>
          <p className="text-xs font-semibold text-muted-foreground">trötthet</p>
        </div>
      </div>
      <TrendChart data={f.trend.map((x) => ({ t: t(x.day), value: x.fitness, label: short(x.day) }))} color="var(--color-brand)" name="Kondition" unit="num" height={130} />
      <p className="text-xs text-muted-foreground">
        Kondition är din träning de senaste ~6 veckorna, trötthet den senaste veckan. Räknas från puls och tid i alla pass med klockan.
      </p>
    </div>
  );
}
