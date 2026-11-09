import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { formatDate, isoDay, weekNumber, weekRange } from "@/lib/dates";
import { applyOverride, formatKm, isRun } from "@/lib/running";
import type { Activity } from "@/lib/types";
import { SyncButton } from "@/components/SyncButton";
import { ActivityRow } from "@/components/ActivityRow";
import { WeeklyVolumeChart, type WeekPoint } from "@/components/charts/WeeklyVolumeChart";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { matchWatchToGym } from "@/lib/watchMerge";

export const dynamic = "force-dynamic";

const COLS = "id, sport_type, name, start_time, distance_m, distance_override_m, moving_time_s, elapsed_time_s, avg_hr, avg_pace_s_per_km, indoor, source";
const WEEKS = 16;
const DAY = 864e5;

export default async function LopningPage() {
  const { supabase } = await requireUser();
  const { days } = weekRange();
  const monday = Date.parse(days[0] + "T00:00:00Z");
  const since = new Date(monday - 26 * 7 * DAY).toISOString();
  const { data } = await supabase
    .from("activities")
    .select(COLS)
    .is("deleted_at", null)
    .gte("start_time", since)
    .order("start_time", { ascending: false });
  const { data: gyms } = await supabase.from("gym_sessions").select("id, started_at, ended_at").gte("started_at", since);
  const merged = matchWatchToGym((data ?? []) as Activity[], gyms ?? []);
  const all = ((data ?? []) as Activity[])
    .filter((a) => !merged.has(a.id)) // klockans styrkepass visas på gympasset i stället
    .map(applyOverride)
    .map((a) => ({ ...a, day: isoDay(new Date(a.start_time)) }));
  const runs = all.filter((a) => isRun(a.sport_type));

  const weeks: WeekPoint[] = Array.from({ length: WEEKS }, (_, i) => {
    const start = monday - (WEEKS - 1 - i) * 7 * DAY;
    const ws = new Date(start).toISOString().slice(0, 10);
    const we = new Date(start + 7 * DAY).toISOString().slice(0, 10);
    const r = runs.filter((x) => x.day >= ws && x.day < we);
    return { label: `v${weekNumber(ws)}`, km: Math.round(r.reduce((s, x) => s + (x.distance_m ?? 0) / 1000, 0) * 10) / 10, runs: r.length, current: i === WEEKS - 1 };
  });
  const thisWeek = weeks.at(-1)!;
  const avg4 = weeks.slice(-5, -1).reduce((s, w) => s + w.km, 0) / 4;

  const label = (a: (typeof runs)[number]) =>
    `${formatDate(a.start_time, { weekday: "short", day: "numeric", month: "short" })} · ${formatKm(a.distance_m)} km${a.indoor ? " inne" : ""}`;
  const chrono = [...runs].reverse();
  // Tempo: utomhuspass och rättade löpbandspass (klockans löpbandsdistans är opålitlig).
  const pace: TrendPoint[] = chrono
    .filter((a) => a.avg_pace_s_per_km && (!a.indoor || a.corrected) && (a.distance_m ?? 0) >= 2000)
    .map((a) => ({ t: Date.parse(a.start_time), value: Number(a.avg_pace_s_per_km), label: label(a), detail: a.avg_hr ? `puls ${a.avg_hr}` : undefined }));
  const hr: TrendPoint[] = chrono
    .filter((a) => a.avg_hr)
    .map((a) => ({ t: Date.parse(a.start_time), value: Number(a.avg_hr), label: label(a) }));

  return (
    <main className="space-y-5 pt-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Löpning</h1>
        <SyncButton />
      </header>

      <section className="card">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm text-muted">Km per vecka</h2>
          <p className="text-sm">
            Denna vecka <span className="font-semibold">{thisWeek.km.toLocaleString("sv-SE")} km</span>
            <span className="text-muted"> · snitt {avg4.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}</span>
          </p>
        </div>
        <WeeklyVolumeChart data={weeks} />
      </section>

      <section className="card">
        <h2 className="text-sm text-muted">Snittempo per pass</h2>
        <p className="mb-2 text-xs text-muted">Utomhus och rättade löpbandspass · högre upp = snabbare</p>
        <TrendChart data={pace} color="var(--color-run)" name="Tempo" unit="pace" invert />
      </section>

      <section className="card">
        <h2 className="mb-2 text-sm text-muted">Snittpuls per pass</h2>
        <TrendChart data={hr} color="var(--color-run)" name="Puls" unit="bpm" />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Senaste passen</h2>
        {all.length === 0 && (
          <p className="card text-muted">
            Inga pass än. Synka från klockan eller <Link href="/installningar/import" className="text-accent">importera från Apple Hälsa</Link>.
          </p>
        )}
        {all.slice(0, 30).map((a) => (
          <ActivityRow key={a.id} a={a} />
        ))}
      </section>
    </main>
  );
}
