import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { formatDate, formatKg, isoDay } from "@/lib/dates";
import { bestSet, e1rm } from "@/lib/gym";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";

export const dynamic = "force-dynamic";

type Row = { id: string; reps: number; weight_kg: number; is_warmup: boolean; session_id: string; gym_sessions: { started_at: string } };

export default async function OvningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [{ data: ex }, { data: sets }] = await Promise.all([
    supabase.from("exercises").select("id, name, muscle_group, is_bodyweight").eq("id", id).maybeSingle(),
    supabase
      .from("gym_sets")
      .select("id, reps, weight_kg, is_warmup, session_id, gym_sessions!inner(started_at)")
      .eq("exercise_id", id)
      .order("created_at"),
  ]);
  if (!ex) notFound();

  const bySession = new Map<string, { date: string; sets: Row[] }>();
  for (const s of (sets ?? []) as unknown as Row[]) {
    const g = bySession.get(s.session_id) ?? { date: s.gym_sessions.started_at, sets: [] };
    g.sets.push(s);
    bySession.set(s.session_id, g);
  }
  const sessions = [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date));
  const usesWeight = sessions.some((s) => s.sets.some((x) => Number(x.weight_kg) > 0));
  const points: TrendPoint[] = sessions.flatMap((s) => {
    const b = bestSet(s.sets, ex.is_bodyweight);
    if (!b) return [];
    const value = usesWeight ? e1rm(Number(b.weight_kg), b.reps) : b.reps;
    return [{ t: Date.parse(s.date), value: Math.round(value * 10) / 10, label: formatDate(s.date, { day: "numeric", month: "short" }), detail: `bästa set ${formatKg(b.weight_kg)} kg × ${b.reps}` }];
  });
  const best = points.reduce<TrendPoint | null>((m, p) => (!m || p.value > m.value ? p : m), null);

  return (
    <main className="space-y-5 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/gym" className="-ml-2 px-2 py-2 text-muted" aria-label="Tillbaka">←</Link>
        <div>
          <h1 className="text-xl font-semibold">{ex.name}</h1>
          {ex.muscle_group && <p className="text-xs text-muted">{ex.muscle_group}</p>}
        </div>
      </header>

      <section className="card">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm text-muted">{usesWeight ? "Uppskattat 1RM per pass" : "Flest reps per pass"}</h2>
          {best && <p className="text-sm">Bästa <span className="font-semibold">{usesWeight ? `${Math.round(best.value)} kg` : `${best.value} st`}</span></p>}
        </div>
        <TrendChart data={points} color="var(--color-gym)" name={usesWeight ? "1RM" : "Reps"} unit={usesWeight ? "kg" : "reps"} />
        {usesWeight && <p className="mt-2 text-xs text-muted">Räknat från bästa arbetssetet varje pass (vikt × (1 + reps/30)).</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Alla pass</h2>
        {sessions.length === 0 && <p className="card text-sm text-muted">Inga set loggade än.</p>}
        {[...sessions].reverse().map((s) => (
          <div key={s.date} className="card flex items-start justify-between gap-3 text-sm">
            <span className="inline-block shrink-0 first-letter:uppercase">{formatDate(isoDay(new Date(s.date)) + "T12:00:00Z", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="text-right text-muted tabular-nums">
              {s.sets.filter((x) => !x.is_warmup).map((x) => `${formatKg(x.weight_kg)}×${x.reps}`).join(" · ")}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
