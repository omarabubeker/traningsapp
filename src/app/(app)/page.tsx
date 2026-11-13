import Link from "next/link";
import { Suspense } from "react";
import { RunWeather } from "@/components/weather/RunWeather";
import { StartSessionButton } from "@/components/StartSessionButton";
import { ActivityRow } from "@/components/ActivityRow";
import { applyOverride, isRun } from "@/lib/running";
import type { Activity } from "@/lib/types";
import { loadPlans } from "@/lib/coach/planData";
import { daysTo, formatTime as raceTime, raceBadge } from "@/lib/goalDef";
import { RaceResult } from "@/components/goals/RaceResult";
import { matchWatchToGym } from "@/lib/watchMerge";
import { TodayHero } from "@/components/TodayHero";
import { WeekRings } from "@/components/goals/WeekRings";
import { MiniBars } from "@/components/goals/MiniBars";
import { streakText } from "@/lib/goals";
import { Celebrate, type CelebrationEvent } from "@/components/goals/Celebrate";
import { CardHead, EmptyState, IconBadge, SectionHead, StatCard } from "@/components/CardParts";
import { Barbell, CalendarCheck, Fire, Medal as MedalIcon, PersonSimpleRun, Target, Trophy } from "@phosphor-icons/react/dist/ssr";
import { loadGoals } from "@/lib/goalsData";
import { loadChallenges } from "@/lib/challengesData";
import { ChallengeCard } from "@/components/challenges/ChallengeCard";
import { formatAmount } from "@/lib/challenges";
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

  // Alla hämtningar startar samtidigt.
  const [{ data }, { data: actData }, { plans }, goals, { data: prof }, challenges] = await Promise.all([
    supabase
      .from("gym_sessions")
      .select("id, started_at, ended_at, gym_sets(reps, weight_kg, is_warmup, exercise_id)")
      .gte("started_at", from)
      .lt("started_at", to)
      .order("started_at"),
    supabase
      .from("activities")
      .select("id, sport_type, name, start_time, distance_m, distance_override_m, moving_time_s, elapsed_time_s, avg_hr, calories, avg_pace_s_per_km, indoor, source")
      .is("deleted_at", null)
      .gte("start_time", from)
      .lt("start_time", to)
      .order("start_time"),
    loadPlans(supabase),
    loadGoals(supabase),
    supabase.from("profile").select("display_name").eq("user_id", user.id).maybeSingle(),
    loadChallenges(supabase, today),
  ]);
  const activities = ((actData ?? []) as Activity[])
    .map(applyOverride)
    .map((a) => ({ ...a, day: isoDay(new Date(a.start_time)) }))
    .filter((a) => days.includes(a.day));
  const runKm = activities.filter((a) => isRun(a.sport_type)).reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0);

  const name = (prof as { display_name: string | null } | null)?.display_name?.trim();
  const todayItems = plans.flatMap((p) => p.items).filter((i) => i.date === today);
  const todayRun = todayItems.find((i) => i.kind === "run" && i.status !== "done");
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

  // "Pass 3 av 5": dagens pass placerat bland veckans planerade (vila räknas inte).
  const weekWork = plans.flatMap((p) => p.items).filter((i) => i.kind !== "rest" && days.includes(i.date));
  const order = Object.fromEntries(weekWork.map((i, n) => [i.id, `Pass ${n + 1} av ${weekWork.length}`]));
  const kmPerDay = days.map((d) => activities.filter((a) => a.day === d && isRun(a.sport_type)).reduce((t, a) => t + (a.distance_m ?? 0) / 1000, 0));
  const todayIdx = days.indexOf(today);
  const fresh = goals.records.filter((r) => r.isNew).slice(0, 3);
  const doneMs = goals.milestones.filter((m) => m.day).length;
  const nextMs = goals.milestones.find((m) => !m.day);
  const goal = goals.goal;
  const raceDays = goal ? daysTo(goal, today) : null;

  // Händelser att fira (visas en gång var): nya milstolpar, nya rekord och stängda ringar.
  const weekAgo = new Date(Date.parse(today + "T12:00:00Z") - 6 * 864e5).toISOString().slice(0, 10);
  const r = goals.rings;
  const ringsClosed = !!r && r.km.target > 0 && r.km.done >= r.km.target && r.gym.done >= r.gym.target && r.plan.total > 0 && r.plan.done >= r.plan.total;
  const events: CelebrationEvent[] = [
    ...goals.milestones
      // bara sådant som nåtts efter att målet sattes (annars firas gamla pass när man byter mål)
      .filter((m) => m.day && m.day >= weekAgo && (!goal?.created_at || m.day >= goal.created_at.slice(0, 10)))
      .map((m) => ({ key: `milstolpe:${m.key}`, kind: "milestone" as const, title: "Ny milstolpe!", text: `${m.label} – ${doneMs} av ${goals.milestones.length} på vägen mot ${goal?.title ?? "målet"}.`, medalText: m.badge })),
    ...goals.history
      .filter((h) => h.completed_at && h.completed_at >= weekAgo)
      .map((h) => ({ key: `mal:${h.id}`, kind: "race" as const, title: `${h.title} klart!`, text: h.result_time_s ? `Din tid: ${raceTime(h.result_time_s)}${h.target_time_s ? ` (mål ${raceTime(h.target_time_s)})` : ""}. Grattis!` : "Grattis till ett avklarat mål!", medalText: h.distance_km ? raceBadge(h.distance_km) : undefined })),
    ...fresh.map((rec) => ({ key: `rekord:${rec.key}:${rec.day}`, kind: "record" as const, title: "Nytt rekord!", text: `${rec.label}: ${rec.value}${rec.previous ? ` (tidigare ${rec.previous})` : ""}` })),
    // Gruppmedalj: firas för alla som var med när gruppen nådde målet.
    ...challenges
      .filter((c) => c.done && c.joined)
      .map((c) => {
        const t = formatAmount(c.metric, c.target);
        return { key: `challenge:${c.id}`, kind: "race" as const, title: "Gruppmedalj!", text: `${c.title}: klart! Ni nådde ${t.value} ${t.unit} tillsammans. Grattis allihop!`, medalText: t.value.length <= 3 ? t.value : undefined };
      }),
    ...(ringsClosed ? [{ key: `ringar:${days[0]}`, kind: "rings" as const, title: "Alla ringar stängda!", text: "Du har gjort hela veckans plan. Starkt jobbat." }] : []),
  ];

  return (
    <main className="space-y-7 pt-4">
      <Celebrate events={events} />
      <header>
        <p className="inline-block text-sm text-muted-foreground first-letter:uppercase">
          {formatDate(today + "T12:00:00Z", { weekday: "long", day: "numeric", month: "long" })}
          {goal && raceDays !== null && raceDays > 0 && <> · <span className="text-foreground tabular-nums">{raceDays}</span> dagar till {goal.title}</>}
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

      {goal && goal.kind === "race" && raceDays !== null && raceDays < 0 && <RaceResult goal={goal} />}
      {!goal && (
        <Link href="/mal" className="card flex items-center gap-3 border-brand/50 py-4 active:bg-secondary">
          <IconBadge icon={Target} tone="brand" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{goals.history.length ? "Dags för nästa mål?" : "Sätt ett mål"}</span>
            <span className="block text-sm text-muted-foreground">Ett lopp eller något annat du vill nå</span>
          </span>
        </Link>
      )}

      <section className="space-y-3">
        <SectionHead title="Idag" href="/plan" link="Hela veckan" />
        {todayItems.length > 0 ? (
          <>
            <TodayHero items={todayItems} order={order} />
            {todayRun && (
              <Suspense fallback={null}>
                <RunWeather supabase={supabase} km={Number((todayRun.target as { distance_km?: number } | null)?.distance_km) || null} />
              </Suspense>
            )}
          </>
        ) : plans.length ? (
          <EmptyState icon={CalendarCheck} title="Inget planerat idag">
            {nextItem ? `Nästa: ${nextItem.title}.` : "Veckans plan är klar."}
          </EmptyState>
        ) : (
          <Link href="/coach" className="block">
            <EmptyState icon={CalendarCheck} tone="brand" title="Ingen plan än">
              Gör en veckoavstämning med coachen för att få veckans pass.
            </EmptyState>
          </Link>
        )}
      </section>

      <section className="space-y-3">
        <SectionHead title="Veckan" href="/mal" link="Mål och rekord" />
        {goals.rings && (
          <Link href="/mal" className="card block space-y-4 active:bg-secondary">
            <CardHead icon={Target} tone="brand" title="Veckans ringar" chevron />
            <WeekRings rings={goals.rings} />
          </Link>
        )}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={PersonSimpleRun} tone="run" title="Löpning" value={runKm.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} unit="km" href="/lopning">
            <MiniBars values={kmPerDay} highlight={todayIdx} labels={WEEKDAYS_SHORT.map((d) => d[0])} />
          </StatCard>
          <StatCard icon={Barbell} tone="gym" title="Gym" value={sessions.length} unit="pass" sub={`${formatKg(Math.round(volume / 100) / 10)} ton lyft`} href="/gym" />
          <StatCard
            icon={Fire}
            tone="streak"
            title="Svit"
            value={goals.streak.current}
            unit={goals.streak.current === 1 ? "vecka" : "veckor"}
            sub={goals.streak.current > 0 ? "i rad med minst 80 % av planen" : streakText(0)}
            href="/mal"
          />
          {nextMs ? (
            <StatCard icon={MedalIcon} tone="brand" title="Milstolpe" value={doneMs} unit={`av ${goals.milestones.length}`} sub={`Nästa: ${nextMs.label}`} href="/mal" />
          ) : (
            <StatCard icon={MedalIcon} tone="brand" title="Milstolpe" value={doneMs} unit={`av ${goals.milestones.length}`} sub="Alla klara!" href="/mal" />
          )}
        </div>
        {fresh.length > 0 && (
          <Link href="/mal" className="card block space-y-3 border-gym/50 active:bg-secondary">
            <CardHead icon={Trophy} tone="gym" title={fresh.length === 1 ? "Nytt rekord!" : "Nya rekord!"} chevron />
            {fresh.map((r) => (
              <p key={r.key} className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="num-lg">{r.value}</span>
              </p>
            ))}
          </Link>
        )}
      </section>

      {challenges.length > 0 && (
        <section className="space-y-3">
          <h2 className="h-section">Tillsammans</h2>
          {challenges.map((c) => (
            <ChallengeCard key={c.id} c={c} today={today} />
          ))}
        </section>
      )}

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

