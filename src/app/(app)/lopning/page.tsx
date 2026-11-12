import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { formatDate, isoDay, weekNumber, weekRange } from "@/lib/dates";
import { applyOverride, formatKm, formatPace, isRun } from "@/lib/running";
import { BigValue, CardHead, EmptyState } from "@/components/CardParts";
import { ChartBar, Heartbeat, PersonSimpleRun, Timer } from "@phosphor-icons/react/dist/ssr";
import type { Activity } from "@/lib/types";
import { SyncButton } from "@/components/SyncButton";
import { ActivityRow } from "@/components/ActivityRow";
import { WeeklyVolumeChart, type WeekPoint } from "@/components/charts/WeeklyVolumeChart";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { matchWatchToGym } from "@/lib/watchMerge";
import { LopningTabs } from "./LopningTabs";

export const dynamic = "force-dynamic";

const COLS = "id, sport_type, name, start_time, distance_m, distance_override_m, moving_time_s, elapsed_time_s, avg_hr, avg_pace_s_per_km, indoor, source";
const WEEKS = 16;
const DAY = 864e5;

export default async function LopningPage({ searchParams }: { searchParams: Promise<{ flik?: string }> }) {
  const { flik } = await searchParams;
  const { supabase } = await requireUser();
  const { days } = weekRange();
  const monday = Date.parse(days[0] + "T00:00:00Z");
  const since = new Date(monday - 26 * 7 * DAY).toISOString();
  const [{ data }, { data: gyms }] = await Promise.all([
    supabase.from("activities").select(COLS).is("deleted_at", null).gte("start_time", since).order("start_time", { ascending: false }),
    supabase.from("gym_sessions").select("id, started_at, ended_at").gte("started_at", since),
  ]);
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
    <main className="space-y-6 pt-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="h-page">Löpning</h1>
          <p className="text-sm text-muted-foreground">
            Denna vecka <span className="font-medium text-foreground">{thisWeek.km.toLocaleString("sv-SE")} km</span> · {thisWeek.runs} pass
          </p>
        </div>
        <SyncButton />
      </header>

      <LopningTabs
        initial={flik === "pass" ? "pass" : "utveckling"}
        pass={
          <>
            {all.length === 0 && (
              <EmptyState icon={PersonSimpleRun} tone="run" title="Inga pass än">
                Synka från klockan eller <Link href="/installningar/import" className="font-medium text-brand">importera från Apple Hälsa</Link>.
              </EmptyState>
            )}
            {all.slice(0, 30).map((a) => (
              <ActivityRow key={a.id} a={a} />
            ))}
          </>
        }
        utveckling={
          <>
            <section className="card space-y-4">
              <CardHead icon={ChartBar} tone="run" title="Km per vecka" right="16 veckor" />
              <div className="space-y-1.5">
                <BigValue value={thisWeek.km.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} unit="km" />
                <p className="text-sm text-muted-foreground">denna vecka · snitt 4 v {avg4.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km</p>
              </div>
              <WeeklyVolumeChart data={weeks} />
            </section>

            <section className="card space-y-4">
              <CardHead icon={Timer} tone="run" title="Snittempo per pass" />
              {pace.length > 0 && (
                <div className="space-y-1.5">
                  <BigValue value={formatPace(pace.at(-1)!.value)} unit="/km" />
                  <p className="text-sm text-muted-foreground">senaste passet · högre upp = snabbare</p>
                </div>
              )}
              <TrendChart data={pace} color="var(--color-run)" name="Tempo" unit="pace" invert />
              <p className="text-xs text-muted-foreground">Utomhus och rättade löpbandspass.</p>
            </section>

            <section className="card space-y-4">
              <CardHead icon={Heartbeat} tone="heart" title="Snittpuls per pass" />
              {hr.length > 0 && (
                <div className="space-y-1.5">
                  <BigValue value={hr.at(-1)!.value} unit="bpm" />
                  <p className="text-sm text-muted-foreground">senaste passet</p>
                </div>
              )}
              <TrendChart data={hr} color="var(--color-heart)" name="Puls" unit="bpm" />
            </section>
          </>
        }
      />
    </main>
  );
}
