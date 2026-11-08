import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/dates";
import { SPORT_LABEL, formatDuration, formatKm, formatPace, isRun } from "@/lib/running";
import type { Activity } from "@/lib/types";
import { RouteSketch } from "./RouteSketch";

export const dynamic = "force-dynamic";

const SOURCE_LABEL = { intervals: "intervals.icu", apple_health: "Apple Hälsa (import)", file: "Fil" };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("activities").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const a = data as Activity;
  const run = isRun(a.sport_type);
  const splits = a.splits ?? [];
  const full = splits.filter((s) => s.dist_m >= 900);
  const fastest = full.length > 1 && new Set(full.map((s) => s.pace_s)).size > 1 ? Math.min(...full.map((s) => s.pace_s)) : null;

  return (
    <main className="space-y-5 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/lopning" className="-ml-2 px-2 py-2 text-muted" aria-label="Tillbaka">←</Link>
        <div>
          <h1 className="text-lg font-semibold">{a.name ?? SPORT_LABEL[a.sport_type] ?? a.sport_type}</h1>
          <p className="inline-block text-xs text-muted first-letter:uppercase">
            {formatDate(a.start_time, { weekday: "long", day: "numeric", month: "long" })} · {formatTime(a.start_time)}
            {a.indoor && " · inomhus"}
          </p>
        </div>
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
          <RouteSketch route={a.route} />
          <p className="px-2 pb-1 text-xs text-muted">Karta kommer i etapp 4.</p>
        </section>
      )}

      {splits.length > 0 && (
        <section className="card">
          <h2 className="mb-2 text-sm text-muted">Splits</h2>
          <table className="w-full text-sm tabular-nums">
            <thead className="text-xs text-muted">
              <tr>
                <th className="py-1 text-left font-normal">Km</th>
                <th className="text-right font-normal">Tempo</th>
                <th className="text-right font-normal">Puls</th>
                <th className="text-right font-normal">Höjd</th>
              </tr>
            </thead>
            <tbody>
              {splits.map((s) => (
                <tr key={s.km} className="border-t border-line">
                  <td className="py-2">{s.dist_m < 990 ? `${(s.dist_m / 1000).toFixed(2).replace(".", ",")}` : s.km}</td>
                  <td className={`text-right ${s.pace_s === fastest ? "text-accent" : ""}`}>{formatPace(s.pace_s)}</td>
                  <td className="text-right text-muted">{s.hr ?? "–"}</td>
                  <td className="text-right text-muted">{s.elev_m != null ? `+${s.elev_m}` : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-center text-xs text-muted">Källa: {SOURCE_LABEL[a.source]}</p>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
