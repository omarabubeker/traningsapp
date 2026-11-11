import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { loadGoals } from "@/lib/goalsData";
import { formatDate, weekNumber } from "@/lib/dates";
import { daysToRace, TRAINING_START } from "@/lib/race";
import { STREAK_SHARE, type RecordItem } from "@/lib/goals";
import { streakText } from "@/components/goals/GoalsSummary";
import { WeekRings } from "@/components/goals/WeekRings";
import { Badge } from "@/components/ui/badge";
import { BigValue, CardHead } from "@/components/CardParts";
import { Check, Fire, FlagCheckered } from "@phosphor-icons/react/dist/ssr";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

const day = (d: string) => formatDate(d + "T12:00:00Z", { day: "numeric", month: "short" });

export default async function MalPage() {
  const { supabase } = await requireUser();
  const g = await loadGoals(supabase);
  const doneCount = g.milestones.filter((m) => m.day).length;
  const nextKey = g.milestones.find((m) => !m.day)?.key;
  const recent = g.weeks.filter((w) => w.total > 0).slice(-8);
  const raceDays = daysToRace(g.today);

  return (
    <main className="space-y-7 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/" className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Tillbaka"><CaretLeft size={22} weight="bold" /></Link>
        <h1 className="h-detail">Mål och rekord</h1>
      </header>

      {/* Vägen till maran */}
      <section className="space-y-3">
        <h2 className="h-section">Vägen till maran</h2>
        <div className="card space-y-4">
          <div className="space-y-2">
            <CardHead icon={FlagCheckered} tone="brand" title="Milstolpar" right={raceDays > 0 ? `${raceDays} dagar kvar` : undefined} />
            <BigValue value={doneCount} unit={`av ${g.milestones.length}`} />
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(doneCount / g.milestones.length) * 100}%` }} />
            </div>
          </div>
          <ol className="space-y-3">
            {g.milestones.map((m) => (
              <li key={m.key} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs ${
                    m.day ? "bg-primary text-primary-foreground" : m.key === nextKey ? "border-2 border-brand" : "border border-border"
                  }`}
                  aria-hidden
                >
                  {m.day ? <Check size={14} weight="bold" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block ${m.day ? "" : m.key === nextKey ? "font-medium" : "text-muted-foreground"}`}>{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.detail}</span>
                </span>
                {m.day && <span className="shrink-0 text-xs text-muted-foreground">{day(m.day)}</span>}
                {m.key === nextKey && <Badge variant="secondary" className="shrink-0">Nästa</Badge>}
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">Räknas från {formatDate(TRAINING_START + "T12:00:00Z", { day: "numeric", month: "long" })}. Tempomålen gäller utomhuspass och rättade löpbandspass.</p>
        </div>
      </section>

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
                    <span className={`flex h-9 items-center justify-center rounded-lg text-xs tabular-nums ${ok ? "bg-brand/20 text-brand" : "bg-muted text-muted-foreground"}`}>
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
