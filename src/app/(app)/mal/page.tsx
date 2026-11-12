import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { loadGoals } from "@/lib/goalsData";
import { formatDate, weekNumber } from "@/lib/dates";
import { daysTo, formatTime, goalPace, goalSummary, raceBadge } from "@/lib/goalDef";
import { formatPace } from "@/lib/running";
import { GoalEditor } from "@/components/goals/GoalEditor";
import { Button } from "@/components/ui/button";
import { STREAK_SHARE, streakText, type RecordItem } from "@/lib/goals";
import { WeekRings } from "@/components/goals/WeekRings";
import { Badge } from "@/components/ui/badge";
import { BigValue, CardHead, EmptyState, IconBadge, SectionHead } from "@/components/CardParts";
import { Barbell, Fire, FlagCheckered, PersonSimpleRun, Target, Trophy } from "@phosphor-icons/react/dist/ssr";
import { Medal } from "@/components/goals/Medal";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

const day = (d: string) => formatDate(d + "T12:00:00Z", { day: "numeric", month: "short" });

export default async function MalPage() {
  const { supabase } = await requireUser();
  const g = await loadGoals(supabase);
  const doneCount = g.milestones.filter((m) => m.day).length;
  const nextKey = g.milestones.find((m) => !m.day)?.key;
  const recent = g.weeks.filter((w) => w.total > 0).slice(-8);
  const goal = g.goal;
  const days = goal ? daysTo(goal, g.today) : null;
  const pace = goal ? goalPace(goal) : null;

  return (
    <main className="space-y-7 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/" className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Tillbaka"><CaretLeft size={22} weight="bold" /></Link>
        <h1 className="h-detail">Mål och rekord</h1>
      </header>

      {/* Målet */}
      <section className="space-y-3">
        <SectionHead title="Ditt mål" />
        {goal ? (
          <div className="card space-y-4">
            <div className="flex items-start gap-3">
              <IconBadge icon={goal.kind === "race" ? PersonSimpleRun : goal.focus === "strength" ? Barbell : Target} tone="brand" size="lg" />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] leading-snug font-bold">{goal.title}</p>
                <p className="text-sm text-muted-foreground">{goalSummary(goal)}</p>
              </div>
            </div>
            {goal.focus === "strength" && goal.target_kg && (
              <div className="grid grid-cols-2 gap-2">
                <Fact value={`${Number(goal.target_kg).toLocaleString("sv-SE")} kg`} unit={`mål i ${goal.exercise?.toLowerCase() ?? "lyftet"}`} />
                <Fact value={days !== null && days >= 0 ? days : "–"} unit={days !== null ? "dagar kvar" : "inget slutdatum"} />
              </div>
            )}
            {goal.kind === "race" && (
              <div className="grid grid-cols-3 gap-2">
                <Fact value={days !== null && days >= 0 ? days : "–"} unit="dagar kvar" />
                <Fact value={goal.target_time_s ? formatTime(goal.target_time_s) : "–"} unit="måltid" />
                <Fact value={pace ? formatPace(pace) : "–"} unit="min/km" />
              </div>
            )}
            <div className="flex gap-2">
              <GoalEditor mode={{ type: "edit", goal }} trigger={<Button variant="secondary" size="sm" className="flex-1">Ändra mål</Button>} />
              <GoalEditor mode={{ type: "new-primary", replaces: goal }} trigger={<Button variant="secondary" size="sm" className="flex-1">Byt till nytt mål</Button>} />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <EmptyState icon={Target} tone="brand" title={g.history.length ? "Dags för nästa mål?" : "Inget mål än"}>
              Sätt ett mål, till exempel ett lopp med datum och måltid. Milstolparna och coachen utgår från det.
            </EmptyState>
            <GoalEditor mode={{ type: "new-primary" }} trigger={<Button className="w-full">Sätt ett mål</Button>} />
          </div>
        )}

        {/* Delmål */}
        {g.subGoals.map((sg) => (
          <div key={sg.id} className="card flex items-center gap-3 py-4">
            <IconBadge icon={Target} tone="muted" />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{sg.title}</span>
              {sg.notes && <span className="block truncate text-sm text-muted-foreground">{sg.notes}</span>}
            </span>
            <GoalEditor mode={{ type: "edit", goal: sg }} trigger={<Button variant="ghost" size="sm">Ändra</Button>} />
          </div>
        ))}
        <GoalEditor mode={{ type: "new-sub" }} trigger={<button className="w-full py-1 text-sm font-semibold text-brand">+ Lägg till delmål</button>} />
      </section>

      {/* Vägen mot målet */}
      {goal && g.milestones.length > 0 && (
        <section className="space-y-3">
          <h2 className="h-section">{goal.kind === "race" || goal.focus === "strength" ? `Vägen till ${goal.title}` : "Milstolpar"}</h2>
          <div className="card space-y-4">
            <div className="space-y-2">
              <CardHead icon={FlagCheckered} tone="brand" title="Milstolpar" right={days !== null && days > 0 ? `${days} dagar kvar` : undefined} />
              <BigValue value={doneCount} unit={`av ${g.milestones.length}`} />
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(doneCount / g.milestones.length) * 100}%` }} />
              </div>
            </div>
            <ol className="space-y-2.5">
              {g.milestones.map((m) => (
                <li key={m.key} className="flex items-center gap-3">
                  <Medal id={`m-${m.key}`} size={44} earned={!!m.day} next={m.key === nextKey} text={m.badge} />
                  <span className="min-w-0 flex-1">
                    <span className={`block ${m.day ? "" : m.key === nextKey ? "font-medium" : "text-muted-foreground"}`}>{m.label}</span>
                    <span className="block text-xs text-muted-foreground">{m.detail}</span>
                  </span>
                  {m.day && <span className="shrink-0 text-xs text-muted-foreground">{day(m.day)}</span>}
                  {m.key === nextKey && <Badge variant="secondary" className="shrink-0">Nästa</Badge>}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              Räknas från {formatDate(goal.start_date + "T12:00:00Z", { day: "numeric", month: "long" })}.{goal.kind === "race" ? " Tempomålen gäller utomhuspass och rättade löpbandspass." : ""}
            </p>
          </div>
        </section>
      )}

      {/* Veckan och sviten */}
      <section className="space-y-3">
        <h2 className="h-section">Veckosvit</h2>
        <div className="card space-y-4">
          {g.rings && <WeekRings rings={g.rings} />}
          <div className={`flex items-center gap-4 ${g.rings ? "border-t border-border pt-4" : ""}`}>
            <Fire size={44} weight={g.streak.current > 0 ? "fill" : "duotone"} className={g.streak.current > 0 ? "shrink-0 text-streak" : "shrink-0 text-muted-foreground"} />
            <div className="space-y-1">
              <BigValue value={g.streak.current} unit={`${g.streak.current === 1 ? "vecka" : "veckor"} i rad`} />
              <p className="text-xs text-muted-foreground">{g.streak.current > 0 ? `Bästa svit: ${g.streak.best} ${g.streak.best === 1 ? "vecka" : "veckor"}` : streakText(0)}</p>
            </div>
          </div>
          {recent.length > 0 && (
            <ol className="grid grid-cols-8 gap-1.5 text-center">
              {recent.map((w) => {
                const pct = Math.round((w.done / w.total) * 100);
                const ok = w.done / w.total >= STREAK_SHARE;
                return (
                  <li key={w.weekStart} className="space-y-1">
                    <span className={`flex h-9 items-center justify-center rounded-lg text-[11px] font-semibold tabular-nums ${ok ? "bg-brand/20 text-brand" : "bg-muted text-muted-foreground"}`}>
                      {pct}%
                    </span>
                    <span className="block text-[10px] text-muted-foreground">v{weekNumber(w.weekStart)}</span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="text-xs text-muted-foreground">
            Pass räknas för hela veckan, oavsett vilken dag du gör dem. Veckor utan plan pausar sviten men bryter den inte.
          </p>
        </div>
      </section>

      {g.history.length > 0 && (
        <section className="space-y-3">
          <h2 className="h-section">Avklarade mål</h2>
          <ul className="card divide-y divide-border p-0">
            {g.history.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-4 py-3">
                {h.kind === "race" && h.distance_km ? (
                  <Medal id={`h-${h.id}`} size={44} text={raceBadge(h.distance_km)} />
                ) : (
                  <IconBadge icon={Trophy} tone="gym" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{h.title}</span>
                  <span className="block text-xs text-muted-foreground">{h.completed_at ? day(h.completed_at) : ""}{h.target_time_s ? ` · mål ${formatTime(h.target_time_s)}` : ""}</span>
                </span>
                {h.result_time_s && <span className="num-lg shrink-0">{formatTime(h.result_time_s)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <Records title="Personliga rekord – löpning" items={g.records.filter((r) => r.group === "run")} />
      <Records title="Personliga rekord – gym" items={g.records.filter((r) => r.group === "gym")} />
    </main>
  );
}

function Records({ title, items }: { title: string; items: RecordItem[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="h-section">{title}</h2>
      <ul className="card divide-y divide-border p-0">
        {items.map((r) => {
          const body = (
            <>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  {r.label}
                  {r.isNew && <Badge className="bg-gym text-[#1a1208]">Nytt</Badge>}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {day(r.day)}
                  {r.previous && ` · tidigare ${r.previous}`}
                </span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{r.value}</span>
            </>
          );
          return (
            <li key={r.key}>
              {r.href ? (
                <Link href={r.href} className="flex items-center justify-between gap-3 px-4 py-3">{body}</Link>
              ) : (
                <div className="flex items-center justify-between gap-3 px-4 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Fact({ value, unit }: { value: number | string; unit: string }) {
  return (
    <div className="rounded-2xl bg-secondary/60 px-3 py-2.5">
      <p className="num-lg">{value}</p>
      <p className="text-xs font-semibold text-muted-foreground">{unit}</p>
    </div>
  );
}
