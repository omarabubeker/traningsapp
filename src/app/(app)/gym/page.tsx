import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { StartSessionButton } from "@/components/StartSessionButton";
import { formatDate, formatTime } from "@/lib/dates";

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
  const active = sessions.find((s) => !s.ended_at);

  return (
    <main className="space-y-5 pt-4">
      <h1 className="text-2xl font-semibold">Gym</h1>

      {active ? (
        <Link href={`/gym/${active.id}`} className="btn-primary w-full">Fortsätt pågående pass</Link>
      ) : (
        <StartSessionButton />
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
