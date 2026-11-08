import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { isoDay, weekNumber, weekRange } from "@/lib/dates";
import { isRun } from "@/lib/running";
import type { Activity } from "@/lib/types";
import { SyncButton } from "@/components/SyncButton";
import { ActivityRow } from "@/components/ActivityRow";

export const dynamic = "force-dynamic";

const COLS = "id, sport_type, name, start_time, distance_m, moving_time_s, avg_hr, avg_pace_s_per_km, indoor, source";

export default async function LopningPage() {
  const { supabase } = await requireUser();
  const { days } = weekRange();
  const monday = new Date(days[0] + "T00:00:00Z").getTime();
  const since = new Date(monday - 7 * 7 * 864e5 - 864e5).toISOString();
  const { data } = await supabase
    .from("activities")
    .select(COLS)
    .is("deleted_at", null)
    .gte("start_time", since)
    .order("start_time", { ascending: false });
  const all = (data ?? []) as Activity[];
  const runs = all.filter((a) => isRun(a.sport_type));

  // Veckovolym senaste 8 veckorna
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = monday - (7 - i) * 7 * 864e5;
    const km = runs
      .filter((r) => {
        const t = new Date(isoDay(new Date(r.start_time)) + "T00:00:00Z").getTime();
        return t >= start && t < start + 7 * 864e5;
      })
      .reduce((s, r) => s + (r.distance_m ?? 0) / 1000, 0);
    return { week: weekNumber(new Date(start).toISOString().slice(0, 10)), km };
  });
  const maxKm = Math.max(5, ...weeks.map((w) => w.km));

  return (
    <main className="space-y-5 pt-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Löpning</h1>
        <SyncButton />
      </header>

      <section className="card">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm text-muted">Km per vecka</h2>
          <p className="text-sm">
            Denna vecka <span className="font-semibold">{weeks[7].km.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km</span>
          </p>
        </div>
        <div className="flex h-28 items-end gap-2">
          {weeks.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-muted">{w.km ? Math.round(w.km) : ""}</span>
              <div className={`w-full rounded-md ${i === 7 ? "bg-run" : "bg-run/40"}`} style={{ height: `${(w.km / maxKm) * 80}px`, minHeight: 2 }} />
              <span className="text-[10px] text-muted">v{w.week}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Senaste passen</h2>
        {all.length === 0 && (
          <p className="card text-muted">
            Inga pass än. Synka från klockan eller <Link href="/installningar/import" className="text-accent">importera från Apple Hälsa</Link>.
          </p>
        )}
        {all.map((a) => (
          <ActivityRow key={a.id} a={a} />
        ))}
      </section>
    </main>
  );
}
