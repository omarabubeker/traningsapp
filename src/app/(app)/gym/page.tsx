import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { StartSessionButton } from "@/components/StartSessionButton";
import { formatDate, formatKg, formatTime, isoDay } from "@/lib/dates";
import { bestSet, e1rm } from "@/lib/gym";
import { monotonePath } from "@/lib/svgPath";
import { Button } from "@/components/ui/button";
import { EmptyState, IconBadge } from "@/components/CardParts";
import { Barbell, Camera, CaretRight } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  started_at: string;
  ended_at: string | null;
  gym_sets: { exercise_id: string; exercises: { name: string } | null }[];
};

export default async function GymPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("gym_sessions")
    .select("id, started_at, ended_at, gym_sets(exercise_id, exercises(name))")
    .order("started_at", { ascending: false })
    .limit(30);
  const sessions = (data ?? []) as unknown as Row[];
  const { data: exData } = await supabase
    .from("exercises")
    .select("id, name, is_bodyweight, gym_sets(reps, weight_kg, is_warmup, created_at)")
    .eq("archived", false)
    .order("name");
  type Ex = { id: string; name: string; is_bodyweight: boolean; gym_sets: { reps: number; weight_kg: number; is_warmup: boolean; created_at: string }[] };
  const DAY = 864e5;
  const now = Date.parse(isoDay() + "T12:00:00Z");
  const exercises = ((exData ?? []) as Ex[])
    .map((e) => ({ ...e, gym_sets: (e.gym_sets ?? []).filter((x) => !x.is_warmup) }))
    .filter((e) => e.gym_sets.length)
    .map((e) => {
      // Bästa set per träningsdag → poäng (uppskattat 1RM, eller reps för kroppsvikt)
      const byDay = new Map<string, typeof e.gym_sets>();
      for (const x of e.gym_sets) byDay.set(x.created_at.slice(0, 10), [...(byDay.get(x.created_at.slice(0, 10)) ?? []), x]);
      const days = [...byDay.keys()].sort();
      const bw = e.is_bodyweight && e.gym_sets.every((x) => Number(x.weight_kg) === 0);
      const score = (x: { reps: number; weight_kg: number }) => (bw ? x.reps : e1rm(Number(x.weight_kg), x.reps));
      const points = days.map((d) => {
        const b = bestSet(byDay.get(d)!, e.is_bodyweight)!;
        return { day: d, best: b, score: score(b) };
      });
      const last = points.at(-1)!;
      const monthAgo = [...points].reverse().find((p) => Date.parse(p.day) <= now - 28 * DAY);
      const change = monthAgo ? last.score - monthAgo.score : null;
      return { id: e.id, name: e.name, bw, last, points: points.slice(-8), change, sessions: points.length };
    })
    .sort((a, b) => b.last.day.localeCompare(a.last.day));
  const ago = (day: string) => {
    const d = Math.round((now - Date.parse(day + "T12:00:00Z")) / DAY);
    return d <= 0 ? "idag" : d === 1 ? "igår" : d < 7 ? `${d} dagar sedan` : d < 14 ? "förra veckan" : `${Math.round(d / 7)} veckor sedan`;
  };
  const active = sessions.find((s) => !s.ended_at);

  return (
    <main className="space-y-7 pt-4">
      <h1 className="h-page">Gym</h1>

      {active ? (
        <Button asChild className="w-full"><Link href={`/gym/${active.id}`}>Fortsätt pågående pass</Link></Button>
      ) : (
        <StartSessionButton />
      )}
      <Link href="/kamera" className="card flex items-center gap-3 active:bg-secondary">
        <IconBadge icon={Camera} tone="brand" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Teknik med kamera</span>
          <span className="block text-sm text-muted-foreground">Knäböj, utfallssteg, planka, armhävningar och marklyft med feedback i realtid</span>
        </span>
        <CaretRight size={14} weight="bold" className="shrink-0 text-muted-foreground" />
      </Link>

      {exercises.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="h-section">Dina övningar</h2>
            <p className="text-sm text-muted-foreground">Tryck på en övning för att se hela utvecklingen.</p>
          </div>
          <ul className="space-y-3">
            {exercises.map((e) => (
              <li key={e.id}>
                <Link href={`/gym/ovning/${e.id}`} className="card flex items-center gap-4 active:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{e.name}</span>
                    <span className="block text-sm text-muted-foreground tabular-nums">
                      {e.bw ? `${e.last.best.reps} reps` : `${formatKg(Number(e.last.best.weight_kg))} kg × ${e.last.best.reps}`} · {ago(e.last.day)}
                    </span>
                  </span>
                  {e.points.length > 1 && <Sparkline id={`sp-${e.id}`} values={e.points.map((p) => p.score)} />}
                  <span className="w-14 shrink-0 text-right text-sm tabular-nums">
                    {e.change == null ? (
                      <span className="text-xs text-muted-foreground">{e.sessions} pass</span>
                    ) : e.change > 0.5 ? (
                      <span className="text-brand">↑ {e.bw ? Math.round(e.change) : formatKg(Math.round(e.change * 2) / 2)}{e.bw ? "" : " kg"}</span>
                    ) : e.change < -0.5 ? (
                      <span className="text-muted-foreground">↓ {e.bw ? Math.round(-e.change) : formatKg(Math.round(-e.change * 2) / 2)}{e.bw ? "" : " kg"}</span>
                    ) : (
                      <span className="text-muted-foreground">→ stabil</span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Kurvan visar bästa set de senaste passen. Pilen jämför med för en månad sedan (uppskattat 1RM).</p>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="h-section">Senaste passen</h2>
        {sessions.length === 0 && <EmptyState icon={Barbell} tone="gym" title="Inga pass loggade än">Tryck på Starta gympass för att logga ditt första pass.</EmptyState>}
        {sessions.map((s) => {
          const names = [...new Map(s.gym_sets.map((x) => [x.exercise_id, x.exercises?.name ?? "?"])).values()];
          return (
            <Link key={s.id} href={`/gym/${s.id}`} className="card flex items-center gap-3 py-4 active:bg-secondary">
              <IconBadge icon={Barbell} tone="gym" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold first-letter:uppercase">{formatDate(s.started_at)}</span>
                <span className="block truncate text-sm text-muted-foreground">{names.length ? names.join(" · ") : "Inga set"}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-semibold">{s.gym_sets.length} set</span>
                <span className="block text-sm text-muted-foreground">{s.ended_at ? formatTime(s.started_at) : "pågår"}</span>
              </span>
            </Link>
          );
        })}
      </section>
    </main>
  );
}

/** Liten trendkurva (bästa set per pass): mjuk linje, gradientyta, senaste punkten markerad. */
function Sparkline({ values, id }: { values: number[]; id: string }) {
  const [w, h, pad] = [72, 32, 4];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [pad + (i * (w - 2 * pad)) / (values.length - 1), max > min ? h - pad - ((v - min) * (h - 2 * pad)) / (max - min) : h / 2] as [number, number]);
  const line = monotonePath(pts);
  const [lx, ly] = pts.at(-1)!;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-gym)" stopOpacity={0.3} />
          <stop offset="100%" stopColor="var(--color-gym)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${pts.at(-1)![0]},${h} L${pts[0][0]},${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke="var(--color-gym)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={3.5} fill="var(--color-gym)" stroke="var(--color-surface)" strokeWidth={1.5} />
    </svg>
  );
}
