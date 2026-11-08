import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { StartSessionButton } from "@/components/StartSessionButton";
import { formatDate, formatKg, formatTime } from "@/lib/dates";
import { bestSet } from "@/lib/gym";

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
  const exercises = ((exData ?? []) as Ex[])
    .map((e) => ({ ...e, gym_sets: e.gym_sets ?? [] }))
    .filter((e) => e.gym_sets.length)
    .map((e) => {
      const latest = [...e.gym_sets].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const lastDay = latest[0]?.created_at.slice(0, 10);
      return { ...e, last: latest[0]?.created_at, best: bestSet(latest.filter((x) => x.created_at.slice(0, 10) === lastDay), e.is_bodyweight) };
    })
    .sort((a, b) => (b.last ?? "").localeCompare(a.last ?? ""));
  const active = sessions.find((s) => !s.ended_at);

  return (
    <main className="space-y-5 pt-4">
      <h1 className="text-2xl font-semibold">Gym</h1>

      {active ? (
        <Link href={`/gym/${active.id}`} className="btn-primary w-full">Fortsätt pågående pass</Link>
      ) : (
        <StartSessionButton />
      )}
      <Link href="/kamera" className="card flex items-center gap-3">
        <span className="text-2xl" aria-hidden>📷</span>
        <span className="flex-1">
          <span className="block font-medium">Teknik med kamera</span>
          <span className="block text-sm text-muted">Knäböj, utfallssteg och planka med feedback i realtid</span>
        </span>
        <span className="text-muted">→</span>
      </Link>

      {exercises.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted">Övningar och utveckling</h2>
          <div className="card divide-y divide-line p-0">
            {exercises.map((e) => (
              <Link key={e.id} href={`/gym/ovning/${e.id}`} className="flex items-center justify-between px-4 py-3">
                <span>{e.name}</span>
                <span className="text-sm text-muted tabular-nums">
                  {e.best ? `${formatKg(e.best.weight_kg)} kg × ${e.best.reps}` : ""} →
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Senaste passen</h2>
        {sessions.length === 0 && <p className="card text-muted">Inga pass loggade än.</p>}
        {sessions.map((s) => {
          const names = [...new Map(s.gym_sets.map((x) => [x.exercise_id, x.exercises?.name ?? "?"])).values()];
          return (
            <Link key={s.id} href={`/gym/${s.id}`} className="card block">
              <div className="flex items-baseline justify-between">
                <span className="font-medium inline-block first-letter:uppercase">{formatDate(s.started_at)}</span>
                <span className="text-sm text-muted">
                  {s.ended_at ? `${formatTime(s.started_at)}–${formatTime(s.ended_at)}` : "pågår"}
                </span>
              </div>
              <p className="mt-1 truncate text-sm text-muted">
                {names.length ? names.join(" · ") : "Inga set"} {s.gym_sets.length > 0 && `(${s.gym_sets.length} set)`}
              </p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
