import Link from "next/link";
import { CalendarCheck, CaretLeft, CaretDown, ChatCircleText, Target } from "@phosphor-icons/react/dist/ssr";
import { requireUser } from "@/lib/supabase/server";
import { loadPlans, type PlanItemWithStatus } from "@/lib/coach/planData";
import { formatDate, weekNumber, WEEKDAYS_SHORT } from "@/lib/dates";
import { PlanItemCard } from "@/components/PlanItemCard";
import { Markdown } from "@/components/Markdown";
import { CardHead, EmptyState } from "@/components/CardParts";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const SEG = { run: "bg-run", gym: "bg-gym", other: "bg-streak", rest: "" } as const;

export default async function PlanPage() {
  const { supabase } = await requireUser();
  const { plans, today } = await loadPlans(supabase);

  return (
    <main className="space-y-7 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/coach" className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Tillbaka"><CaretLeft size={22} weight="bold" /></Link>
        <h1 className="h-detail">Plan</h1>
      </header>

      {plans.length === 0 && (
        <div className="space-y-3">
          <EmptyState icon={CalendarCheck} tone="brand" title="Ingen plan än">
            Gör en veckoavstämning med coachen så skapas nästa veckas plan.
          </EmptyState>
          <Button asChild className="w-full"><Link href="/coach">Till coachen</Link></Button>
        </div>
      )}

      {plans.map((p) => {
        const work = p.items.filter((i) => i.kind !== "rest");
        const runs = work.filter((i) => i.kind === "run");
        const km = runs.reduce((s, i) => s + (Number((i.target as { distance_km?: number } | null)?.distance_km) || 0), 0);
        const done = work.filter((i) => i.status === "done").length;
        const days = [...new Set(p.items.map((i) => i.date))].sort();
        const byDay = (d: string) => p.items.filter((i) => i.date === d);
        return (
          <section key={p.id} className="space-y-4">
            {/* Veckokortet: förlopp per pass (ett segment per pass i sportens färg) och nyckeltal */}
            <div className="card space-y-4">
              <CardHead icon={CalendarCheck} tone="brand" title={`Vecka ${weekNumber(p.week_start)}`} right={`${done} av ${work.length} klara`} />
              <div className="flex gap-1" aria-label={`${done} av ${work.length} pass klara`}>
                {work.map((i) => (
                  <span key={i.id} className={`h-2.5 flex-1 rounded-full ${i.status === "done" ? SEG[i.kind] : "bg-secondary"}`} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Fact value={runs.length} unit="löppass" />
                <Fact value={km ? `${Math.round(km)}` : "–"} unit="km" />
                <Fact value={work.filter((i) => i.kind === "gym").length} unit="gympass" />
              </div>
            </div>

            {p.focus && (
              <div className="card space-y-2">
                <CardHead icon={Target} tone="brand" title="Veckans fokus" />
                <p className="text-[15px] leading-relaxed">{p.focus}</p>
              </div>
            )}

            {/* Tidslinje dag för dag */}
            <ol className="relative">
              {days.map((d, idx) => (
                <li key={d} className="relative flex gap-3 pb-4 last:pb-0">
                  {idx < days.length - 1 && <span className="absolute top-12 bottom-0 left-[1.4rem] w-px bg-border" aria-hidden />}
                  <DayMark day={d} today={today} items={byDay(d)} />
                  <div className="min-w-0 flex-1 space-y-3">
                    {byDay(d).map((it) => (
                      <PlanItemCard key={it.id} item={it} status={it.status} doneDay={it.doneDay} showDate={false} today={today} />
                    ))}
                  </div>
                </li>
              ))}
            </ol>

            {p.summary && (
              <details className="card group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-[15px] font-semibold text-brand">
                    <ChatCircleText size={18} weight="duotone" /> Coachens genomgång
                  </span>
                  <CaretDown size={14} weight="bold" className="text-muted-foreground transition group-open:rotate-180" />
                </summary>
                <div className="mt-3 text-sm"><Markdown text={p.summary} /></div>
              </details>
            )}
          </section>
        );
      })}
    </main>
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

/** Dagens markering i tidslinjen: veckodag och datum, idag i lime, gjord dag med bock. */
function DayMark({ day, today, items }: { day: string; today: string; items: PlanItemWithStatus[] }) {
  const isToday = day === today;
  const work = items.filter((i) => i.kind !== "rest");
  const allDone = work.length > 0 && work.every((i) => i.status === "done");
  const dow = WEEKDAYS_SHORT[(new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7];
  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-0.5 pt-1.5" aria-label={formatDate(day + "T12:00:00Z", { weekday: "long", day: "numeric", month: "long" })}>
      <span className={`text-[11px] font-bold uppercase ${isToday ? "text-brand" : "text-muted-foreground"}`}>{dow}</span>
      <span
        className={`flex size-9 items-center justify-center rounded-full text-[15px] font-extrabold tabular-nums ${
          isToday ? "bg-primary text-primary-foreground" : allDone ? "bg-brand/15 text-brand" : "bg-secondary"
        }`}
      >
        {Number(day.slice(8))}
      </span>
    </div>
  );
}
