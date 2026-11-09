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
  const fastest = full.length > 1 && new Set(full.map((s) => s.pace_s)).size > 1 ? Math.min(...full.map((s) => s.pace_s)) : null;

  return (
    <main className="space-y-5 pt-3">
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

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Distans" value={a.distance_m ? `${formatKm(a.distance_m)} km` : "–"} />
        <Stat label="Tid" value={formatDuration(a.moving_time_s ?? a.elapsed_time_s)} />
        <Stat label={run ? "Tempo" : "Snittfart"} value={run ? `${formatPace(a.avg_pace_s_per_km)}/km` : a.distance_m && a.moving_time_s ? `${((a.distance_m / a.moving_time_s) * 3.6).toFixed(1)} km/h` : "–"} />
        <Stat label="Snittpuls" value={a.avg_hr ? `${a.avg_hr}` : "–"} />
        <Stat label="Maxpuls" value={a.max_hr ? `${a.max_hr}` : "–"} />
        <Stat label="Höjdmeter" value={a.elevation_gain_m != null ? `${Math.round(a.elevation_gain_m)} m` : "–"} />
      </section>

      {a.route && a.route.length > 1 && (
        <section className="card p-2">
          <RouteMapLoader route={a.route} />
        </section>
      )}

      {splits.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm text-muted-foreground">Splits</h2>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-normal">{factor === 1 ? "Km" : "Vid km"}</th>
                <th className="text-right font-normal">Tempo</th>
                <th className="text-right font-normal">Puls</th>
                <th className="text-right font-normal">Höjd</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((s) => (
                <tr key={s.km} className="border-t border-line">
                  <td className="py-2">{s.label}</td>
                  <td className={`text-right ${s.pace_s === fastest ? "text-brand" : ""}`}>{formatPace(s.pace_s)}</td>
                  <td className="text-right text-muted-foreground">{s.hr ?? "–"}</td>
                  <td className="text-right text-muted-foreground">{s.elev_m != null ? `+${s.elev_m}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

/** Generiska namn från klockan ("Run", "Indoor Run") visas som svensk passtyp. */
function displayName(a: Activity) {
  const label = SPORT_LABEL[a.sport_type] ?? a.sport_type;
  if (!a.name || /^(indoor |outdoor |morning |afternoon |evening |lunch )?(run|running|walk|walking|ride|cycling|workout)$/i.test(a.name.trim())) return label;
  return a.name;
}
