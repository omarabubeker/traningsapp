import Link from "next/link";
import { StartSessionButton } from "@/components/StartSessionButton";
import { ActivityRow } from "@/components/ActivityRow";
import { isRun } from "@/lib/running";
import type { Activity } from "@/lib/types";
import { loadPlans } from "@/lib/coach/planData";
import { PlanItemCard } from "@/components/PlanItemCard";
import { requireUser } from "@/lib/supabase/server";
import { WEEKDAYS_SHORT, formatKg, formatTime, isoDay, weekNumber, weekRange } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  started_at: string;
  ended_at: string | null;
  gym_sets: { reps: number; weight_kg: number; is_warmup: boolean; exercise_id: string }[];
};

export default async function Overview() {
  const { supabase } = await requireUser();
  const { days, today, from, to } = weekRange();

  const { data } = await supabase
    .from("gym_sessions")
    .select("id, started_at, ended_at, gym_sets(reps, weight_kg, is_warmup, exercise_id)")
    .gte("started_at", from)
    .lt("started_at", to)
    .order("started_at");

  const { data: actData } = await supabase
    .from("activities")
    .select("id, sport_type, name, start_time, distance_m, moving_time_s, avg_hr, avg_pace_s_per_km, indoor, source")
    .is("deleted_at", null)
    .gte("start_time", from)
    .lt("start_time", to)
    .order("start_time");
  const activities = ((actData ?? []) as Activity[])
    .map((a) => ({ ...a, day: isoDay(new Date(a.start_time)) }))
    .filter((a) => days.includes(a.day));
  const runKm = activities.filter((a) => isRun(a.sport_type)).reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0);

  const { plans } = await loadPlans(supabase);
  const todayItems = plans.flatMap((p) => p.items).filter((i) => i.date === today);
  const nextItem = plans.flatMap((p) => p.items).find((i) => i.date > today && i.kind !== "rest");

  const sessions = ((data ?? []) as Row[])
    .map((s) => ({ ...s, day: isoDay(new Date(s.started_at)) }))
    .filter((s) => days.includes(s.day));

  const work = sessions.flatMap((s) => s.gym_sets.filter((x) => !x.is_warmup));
  const volume = work.reduce((sum, x) => sum + x.reps * Number(x.weight_kg), 0);
  const active = sessions.find((s) => !s.ended_at);

  return (
    <main className="space-y-5 pt-4">
      <header>
        <p className="text-sm text-muted">Vecka {weekNumber(today)}</p>
        <h1 className="text-2xl font-semibold">Översikt</h1>
      </header>

      {active && (
        <Link href={`/gym/${active.id}`} className="card flex items-center justify-between border-accent/50">
          <span>
            <span className="block font-medium">Pågående gympass</span>
            <span className="text-sm text-muted">Startat {formatTime(active.started_at)}</span>
          </span>
          <span className="text-accent">Fortsätt →</span>
        </Link>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Idag enligt planen</h2>
          <Link href="/plan" className="text-sm text-accent">Hela veckan →</Link>
        </div>
        {todayItems.length > 0 ? (
          todayItems.map((it) => <PlanItemCard key={it.id} item={it} status={it.status} showDate={false} />)
        ) : plans.length ? (
          <p className="card text-sm text-muted">
            Inget planerat idag.{nextItem ? ` Nästa: ${nextItem.title}.` : ""}
          </p>
        ) : (
          <Link href="/coach" className="card block text-sm text-muted">Ingen plan än – gör en veckoavstämning med coachen →</Link>
        )}
      </section>

      <section className="card">
        <ol className="grid grid-cols-7 gap-1 text-center">
          {days.map((d, i) => {
            const gym = sessions.some((s) => s.day === d);
            const ran = activities.some((a) => a.day === d && isRun(a.sport_type));
            return (
              <li key={d} className="flex flex-col items-center gap-2">
                <span className={`text-xs ${d === today ? "text-text" : "text-muted"}`}>{WEEKDAYS_SHORT[i]}</span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                    ran && gym ? "bg-accent/20 text-accent" : ran ? "bg-run/20 text-run" : gym ? "bg-gym/20 text-gym" : d === today ? "border border-line" : "text-muted"
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Löpning" value={`${runKm.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km`} />
        <Stat label="Gympass" value={String(sessions.length)} />
        <Stat label="Gymvolym" value={`${formatKg(Math.round(volume / 100) / 10)} t`} />
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted">Veckans pass</h2>
        {sessions.length === 0 && activities.length === 0 && <p className="card text-muted">Inga pass än den här veckan.</p>}
        {activities.map((a) => (
          <ActivityRow key={a.id} a={a} />
        ))}
        {sessions.map((s) => (
          <Link key={s.id} href={`/gym/${s.id}`} className="card flex items-center justify-between">
            <span>
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-gym align-middle" />
              <span className="font-medium">Gym</span>
              <span className="ml-2 text-sm text-muted">
                {WEEKDAYS_SHORT[days.indexOf(s.day)]} {formatTime(s.started_at)}
              </span>
            </span>
            <span className="text-sm text-muted">
              {new Set(s.gym_sets.map((x) => x.exercise_id)).size} övn · {s.gym_sets.length} set
            </span>
          </Link>
        ))}
      </section>

      {!active && <StartSessionButton />}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
