import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { formatDate, formatKg, isoDay } from "@/lib/dates";
import { bestSet, e1rm } from "@/lib/gym";
import { TrendChart, type TrendPoint } from "@/components/charts/TrendChart";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { BigValue, CardHead } from "@/components/CardParts";
import { ChartLineUp } from "@phosphor-icons/react/dist/ssr";

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
    <main className="space-y-7 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/gym" className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Tillbaka"><CaretLeft size={22} weight="bold" /></Link>
        <div>
          <h1 className="h-detail">{ex.name}</h1>
          {ex.muscle_group && <p className="text-xs text-muted-foreground">{ex.muscle_group}</p>}
        </div>
      </header>

      <section className="card space-y-4">
        <CardHead icon={ChartLineUp} tone="gym" title={usesWeight ? "Uppskattat 1RM per pass" : "Flest reps per pass"} />
        {best && (
          <div className="space-y-1.5">
            <BigValue value={usesWeight ? Math.round(best.value) : best.value} unit={usesWeight ? "kg" : "reps"} />
            <p className="text-sm text-muted-foreground">bästa hittills</p>
          </div>
        )}
        <TrendChart data={points} color="var(--color-gym)" name={usesWeight ? "1RM" : "Reps"} unit={usesWeight ? "kg" : "reps"} />
        {usesWeight && <p className="text-xs text-muted-foreground">Räknat från bästa arbetssetet varje pass (vikt × (1 + reps/30)).</p>}
      </section>

      <section className="space-y-3">
        <h2 className="h-section">Alla pass</h2>
        {sessions.length === 0 && <p className="card text-sm text-muted-foreground">Inga set loggade än.</p>}
        {[...sessions].reverse().map((s) => (
          <div key={s.date} className="card flex items-start justify-between gap-3 text-sm">
            <span className="inline-block shrink-0 first-letter:uppercase">{formatDate(isoDay(new Date(s.date)) + "T12:00:00Z", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className="text-right text-muted-foreground tabular-nums">
              {s.sets.filter((x) => !x.is_warmup).map((x) => `${formatKg(x.weight_kg)}×${x.reps}`).join(" · ")}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}
