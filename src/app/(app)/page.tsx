import Link from "next/link";
import { StartSessionButton } from "@/components/StartSessionButton";
import { ActivityRow } from "@/components/ActivityRow";
import { applyOverride, isRun } from "@/lib/running";
import type { Activity } from "@/lib/types";
import { loadPlans } from "@/lib/coach/planData";
import { daysToRace } from "@/lib/race";
import { matchWatchToGym } from "@/lib/watchMerge";
import { TodayPlan } from "@/components/TodayPlan";
import { EmptyState, IconBadge, SectionHead, StatCard } from "@/components/CardParts";
import { Barbell, CalendarCheck, PersonSimpleRun } from "@phosphor-icons/react/dist/ssr";
import { GoalsSummary } from "@/components/goals/GoalsSummary";
import { loadGoals } from "@/lib/goalsData";
import { requireUser } from "@/lib/supabase/server";
import { WEEKDAYS_SHORT, formatDate, formatKg, formatTime, greeting, isoDay, weekRange } from "@/lib/dates";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  started_at: string;
  ended_at: string | null;
  gym_sets: { reps: number; weight_kg: number; is_warmup: boolean; exercise_id: string }[];
};

export default async function Overview() {
  const { supabase, user } = await requireUser();
  const { days, today, from, to } = weekRange();
  const raceDays = daysToRace(today);

  const { data } = await supabase
    .from("gym_sessions")
    .select("id, started_at, ended_at, gym_sets(reps, weight_kg, is_warmup, exercise_id)")
    .gte("started_at", from)
    .lt("started_at", to)
    .order("started_at");

  const { data: actData } = await supabase
    .from("activities")
    .select("id, sport_type, name, start_time, distance_m, distance_override_m, moving_time_s, elapsed_time_s, avg_hr, calories, avg_pace_s_per_km, indoor, source")
    .is("deleted_at", null)
    .gte("start_time", from)
    .lt("start_time", to)
    .order("start_time");
  const activities = ((actData ?? []) as Activity[])
    .map(applyOverride)
    .map((a) => ({ ...a, day: isoDay(new Date(a.start_time)) }))
    .filter((a) => days.includes(a.day));
  const runKm = activities.filter((a) => isRun(a.sport_type)).reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0);

  const [{ plans }, goals, { data: prof }] = await Promise.all([
    loadPlans(supabase),
    loadGoals(supabase),
    supabase.from("profile").select("display_name").eq("user_id", user.id).maybeSingle(),
  ]);
  const name = (prof as { display_name: string | null } | null)?.display_name?.trim();
  const todayItems = plans.flatMap((p) => p.items).filter((i) => i.date === today);
  const nextItem = plans.flatMap((p) => p.items).find((i) => i.date > today && i.kind !== "rest");

  const sessions = ((data ?? []) as Row[])
    .map((s) => ({ ...s, day: isoDay(new Date(s.started_at)) }))
    .filter((s) => days.includes(s.day));

  // Styrkepass från klockan som hör till ett loggat gympass visas inte separat.
  const watchToGym = matchWatchToGym(activities, sessions);
  const watchFor = (sessionId: string) => activities.find((a) => watchToGym.get(a.id) === sessionId);
  const shownActivities = activities.filter((a) => !watchToGym.has(a.id));

  const work = sessions.flatMap((s) => s.gym_sets.filter((x) => !x.is_warmup));
  const volume = work.reduce((sum, x) => sum + x.reps * Number(x.weight_kg), 0);
  const active = sessions.find((s) => !s.ended_at);

  return (
    <main className="space-y-7 pt-4">
      <header>
        <p className="inline-block text-sm text-muted-foreground first-letter:uppercase">
          {formatDate(today + "T12:00:00Z", { weekday: "long", day: "numeric", month: "long" })}
          {raceDays > 0 && <> · <span className="text-foreground tabular-nums">{raceDays}</span> dagar till maran</>}
        </p>
        <h1 className="h-page">{greeting()}{name ? `, ${name}` : ""}</h1>
      </header>

      {active && (
        <Link href={`/gym/${active.id}`} className="card flex items-center gap-3 border-gym/50 py-4">
          <IconBadge icon={Barbell} tone="gym" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Pågående gympass</span>
            <span className="block text-sm text-muted-foreground">Startat {formatTime(active.started_at)}</span>
          </span>
          <span className="text-sm font-semibold text-brand">Fortsätt</span>
        </Link>
      )}

      <section className="space-y-3">
        <SectionHead title="Idag" href="/plan" link="Hela veckan" />
        {todayItems.length > 0 ? (
          <TodayPlan items={todayItems} />
        ) : plans.length ? (
          <p className="card text-sm text-muted-foreground">
            Inget planerat idag.{nextItem ? ` Nästa: ${nextItem.title}.` : ""}
          </p>
        ) : (
          <Link href="/coach" className="card block text-sm text-muted-foreground">Ingen plan än – gör en veckoavstämning med coachen →</Link>
        )}
      </section>

      <GoalsSummary goals={goals} />

      <section className="card">
        <ol className="grid grid-cols-7 gap-1 text-center">
          {days.map((d, i) => {
            const gym = sessions.some((s) => s.day === d);
            const ran = activities.some((a) => a.day === d && isRun(a.sport_type));
            return (
              <li key={d} className="flex flex-col items-center gap-2">
                <span className={`text-xs ${d === today ? "text-text" : "text-muted-foreground"}`}>{WEEKDAYS_SHORT[i]}</span>
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                    ran && gym ? "bg-brand/20 text-brand" : ran ? "bg-run/20 text-run" : gym ? "bg-gym/20 text-gym" : d === today ? "border border-line" : "text-muted-foreground"
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatCard icon={PersonSimpleRun} tone="run" title="Löpning" value={runKm.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} unit="km" sub="denna vecka" href="/lopning" />
        <StatCard icon={Barbell} tone="gym" title="Gym" value={sessions.length} unit={sessions.length === 1 ? "pass" : "pass"} sub={`${formatKg(Math.round(volume / 100) / 10)} t lyft`} href="/gym" />
      </section>

      <section className="space-y-3">
        <h2 className="h-section">Veckans pass</h2>
        {sessions.length === 0 && shownActivities.length === 0 && <EmptyState icon={CalendarCheck} title="Inga pass än den här veckan" />}
        {shownActivities.map((a) => (
          <ActivityRow key={a.id} a={a} />
        ))}
        {sessions.map((s) => (
          <Link key={s.id} href={`/gym/${s.id}`} className="card flex items-center gap-3 py-4 active:bg-secondary">
            <IconBadge icon={Barbell} tone="gym" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Gym</span>
              <span className="block text-sm text-muted-foreground">
                {WEEKDAYS_SHORT[days.indexOf(s.day)]} {formatTime(s.started_at)}
              </span>
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="block font-semibold">{s.gym_sets.length} set</span>
              <span className="block text-sm text-muted-foreground">
                {watchFor(s.id)?.avg_hr ? `♥ ${watchFor(s.id)!.avg_hr}` : `${new Set(s.gym_sets.map((x) => x.exercise_id)).size} övningar`}
              </span>
            </span>
          </Link>
        ))}
      </section>

      {!active && <StartSessionButton />}
    </main>
  );
}

