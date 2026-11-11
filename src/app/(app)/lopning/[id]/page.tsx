import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/dates";
import { SPORT_LABEL, applyOverride, formatDuration, formatKm, formatPace, isRun } from "@/lib/running";
import type { Activity } from "@/lib/types";
import { DistanceEditor } from "./DistanceEditor";
import { RouteMapLoader } from "./RouteMapLoader";
import { ActivityMenu } from "./DeleteActivity";

export const dynamic = "force-dynamic";

const SOURCE_LABEL = { intervals: "intervals.icu", apple_health: "Apple Hälsa (import)", file: "Fil" };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("activities").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = applyOverride(data as Activity);
  const run = isRun(a.sport_type);
  // Vid rättad distans skalas splitsen om proportionellt (ungefärligt).
  const factor = a.corrected && a.watch_distance_m ? Number(a.distance_m) / Number(a.watch_distance_m) : 1;
  const raw = a.splits ?? [];
  const ends = raw.map((_, i) => raw.slice(0, i + 1).reduce((t, x) => t + x.dist_m, 0));
  const splits = raw.map((s, i) =>
    factor === 1
      ? { ...s, label: s.dist_m < 990 ? (s.dist_m / 1000).toFixed(2).replace(".", ",") : String(s.km) }
      : // Visa var i den rättade distansen splitten slutar, t.ex. 1,53 – 3,06 – …
        { ...s, pace_s: Math.round(s.pace_s / factor), label: ((ends[i] * factor) / 1000).toFixed(2).replace(".", ",") },
  );
  const full = splits.filter((s) => s.dist_m >= 900);
  const paces = full.map((s) => s.pace_s);
  const [minP, maxP] = [Math.min(...paces), Math.max(...paces)];
  // Stapelns längd: snabbaste split 100 %, långsammaste 45 %.
  const barWidth = (p: number) => (maxP > minP ? 45 + (55 * (maxP - Math.min(p, maxP))) / (maxP - minP) : 80);
  const { data: prof } = await supabase.from("profile").select("max_hr").maybeSingle();
  const maxHr = (prof as { max_hr: number | null } | null)?.max_hr ?? null;
  const zone = a.avg_hr && maxHr ? hrZone(a.avg_hr, maxHr) : null;
  const fastest = full.length > 1 && new Set(full.map((s) => s.pace_s)).size > 1 ? Math.min(...full.map((s) => s.pace_s)) : null;

  return (
    <main className="space-y-7 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/lopning" className="-ml-2 px-2 py-2 text-muted-foreground" aria-label="Tillbaka">←</Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{displayName(a)}</h1>
          <p className="inline-block text-xs text-muted-foreground first-letter:uppercase">
            {formatDate(a.start_time, { weekday: "long", day: "numeric", month: "long" })} · {formatTime(a.start_time)}
            {a.indoor && " · inomhus"}
          </p>
        </div>
        <ActivityMenu id={a.id} />
      </header>

      <section className="card space-y-5">
        <div>
          <p className="text-xs text-muted-foreground">Distans</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {a.distance_m ? formatKm(a.distance_m) : "–"}
            <span className="ml-1 text-lg font-normal text-muted-foreground">km</span>
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          <Big label="Tid" value={formatDuration(a.moving_time_s ?? a.elapsed_time_s)} />
          <Big
            label={run ? "Tempo" : "Snittfart"}
            value={run ? formatPace(a.avg_pace_s_per_km) : a.distance_m && a.moving_time_s ? ((a.distance_m / a.moving_time_s) * 3.6).toFixed(1).replace(".", ",") : "–"}
            unit={run ? "/km" : "km/h"}
          />
          <Big label="Snittpuls" value={a.avg_hr ? String(a.avg_hr) : "–"} unit={a.avg_hr ? "bpm" : undefined} />
        </div>
        {zone && <HrZones avg={a.avg_hr!} max={maxHr!} zone={zone} />}
        <p className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
          {a.max_hr ? <span>Maxpuls <span className="text-foreground">{a.max_hr}</span></span> : null}
          {a.elevation_gain_m != null ? <span>Höjdmeter <span className="text-foreground">{Math.round(a.elevation_gain_m)} m</span></span> : null}
          {a.calories ? <span>Energi <span className="text-foreground">{a.calories} kcal</span></span> : null}
          {a.moving_time_s && a.elapsed_time_s && a.elapsed_time_s - a.moving_time_s > 60 ? (
            <span>Total tid <span className="text-foreground">{formatDuration(a.elapsed_time_s)}</span></span>
          ) : null}
        </p>
      </section>

      {a.route && a.route.length > 1 && (
        <section className="card p-2">
          <RouteMapLoader route={a.route} />
        </section>
      )}

      {splits.length > 0 && (
        <section className="card space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm text-muted-foreground">Tempo per {factor === 1 ? "km" : "split"}</h2>
            <span className="text-xs text-muted-foreground">längre stapel = snabbare</span>
          </div>
          <ol className="space-y-1.5 text-sm tabular-nums">
            {splits.map((s) => (
              <li key={s.km} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3">
                <span className="text-muted-foreground">{s.label}</span>
                <span className="relative h-7 overflow-hidden rounded-md bg-muted">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-md ${s.pace_s === fastest ? "bg-brand/80" : "bg-run/45"}`}
                    style={{ width: `${barWidth(s.pace_s)}%` }}
                  />
                  <span className="relative flex h-full items-center px-2 font-medium">{formatPace(s.pace_s)}</span>
                </span>
                <span className="text-right text-xs text-muted-foreground">{s.hr ?? "–"}</span>
              </li>
            ))}
          </ol>
          <p className="text-right text-xs text-muted-foreground">puls per {factor === 1 ? "km" : "split"} till höger</p>
        </section>
      )}

      {run && (
        <DistanceEditor id={a.id} watchDistance={a.watch_distance_m} override={a.corrected ? a.distance_m : null} />
      )}
      <p className="text-center text-xs text-muted-foreground">
        Källa: {SOURCE_LABEL[a.source]}
        {a.corrected && ` · distans rättad manuellt (klockan: ${formatKm(a.watch_distance_m)} km), splits omräknade`}
      </p>
    </main>
  );
}

function Big({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

// Pulszoner som andel av maxpuls (enkel femzonsmodell).
const ZONES = [
  { name: "Zon 1", desc: "återhämtning", to: 0.6, color: "#6b7a86" },
  { name: "Zon 2", desc: "lugn distans", to: 0.7, color: "var(--color-run)" },
  { name: "Zon 3", desc: "medel", to: 0.8, color: "var(--color-brand)" },
  { name: "Zon 4", desc: "tröskel", to: 0.9, color: "var(--color-gym)" },
  { name: "Zon 5", desc: "max", to: 1.0, color: "var(--color-danger)" },
];
const ZONE_FROM = 0.5; // stapeln börjar vid 50 % av maxpuls

function hrZone(avg: number, max: number) {
  const share = avg / max;
  return { share, ...(ZONES.find((z) => share < z.to) ?? ZONES[4]) };
}

function HrZones({ avg, max, zone }: { avg: number; max: number; zone: ReturnType<typeof hrZone> }) {
  const pos = Math.max(0, Math.min(1, (zone.share - ZONE_FROM) / (1 - ZONE_FROM))) * 100;
  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className="font-medium">{zone.name}</span>
        <span className="text-muted-foreground"> · {zone.desc} · {Math.round(zone.share * 100)} % av maxpuls ({max})</span>
      </p>
      <div className="relative pt-1">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {ZONES.map((z, i) => {
            const from = i === 0 ? ZONE_FROM : ZONES[i - 1].to;
            return <span key={z.name} style={{ flex: `${Math.round((z.to - from) * 100)} 1 0%`, background: z.color, opacity: z.name === zone.name ? 1 : 0.3 }} />;
          })}
        </div>
        <span
          className="absolute top-0 size-4 -translate-x-1/2 rounded-full border-2 border-background"
          style={{ left: `${pos}%`, background: zone.color }}
          aria-label={`Snittpuls ${avg}`}
        />
      </div>
    </div>
  );
}

/** Generiska namn från klockan ("Run", "Indoor Run") visas som svensk passtyp. */
function displayName(a: Activity) {
  const label = SPORT_LABEL[a.sport_type] ?? a.sport_type;
  if (!a.name || /^(indoor |outdoor |morning |afternoon |evening |lunch )?(run|running|walk|walking|ride|cycling|workout)$/i.test(a.name.trim())) return label;
  return a.name;
}
