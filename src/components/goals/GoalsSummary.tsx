import Link from "next/link";
import type { Goals } from "@/lib/goalsData";
import { WeekRings } from "./WeekRings";
import { CardHead, IconBadge, SectionHead } from "@/components/CardParts";
import { CaretRight, Fire, Medal, Target, Trophy } from "@phosphor-icons/react/dist/ssr";

const sv = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 1 });

export function streakText(current: number) {
  return current === 0 ? "Gör minst 80 % av veckans plan för att starta en svit" : `${current} ${current === 1 ? "vecka" : "veckor"} i rad med minst 80 % av planen`;
}

/** Översiktens mål-kort: veckoringar, svit, nya rekord och nästa milstolpe. */
export function GoalsSummary({ goals }: { goals: Goals }) {
  const fresh = goals.records.filter((r) => r.isNew).slice(0, 3);
  const done = goals.milestones.filter((m) => m.day).length;
  const next = goals.milestones.find((m) => !m.day);
  return (
    <section className="space-y-3">
      <SectionHead title="Veckans mål" href="/mal" link="Mål och rekord" />

      <div className="card space-y-4">
        <CardHead icon={Target} tone="brand" title="Veckans ringar" />
        {goals.rings ? (
          <WeekRings rings={goals.rings} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Ingen plan den här veckan ({sv(goals.weekKm)} km hittills). Gör en veckoavstämning med coachen för att få veckans mål.
          </p>
        )}
        <p className="flex items-center gap-2 border-t border-border pt-4 text-sm">
          <Fire size={20} weight={goals.streak.current > 0 ? "fill" : "duotone"} className={goals.streak.current > 0 ? "text-streak" : "text-muted-foreground"} />
          <span className={goals.streak.current > 0 ? "font-medium" : "text-muted-foreground"}>{streakText(goals.streak.current)}</span>
        </p>
      </div>

      {fresh.length > 0 && (
        <Link href="/mal" className="card block space-y-3 border-gym/50">
          <CardHead icon={Trophy} tone="gym" title={fresh.length === 1 ? "Nytt rekord!" : "Nya rekord!"} chevron />
          {fresh.map((r) => (
            <p key={r.key} className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-muted-foreground">{r.label}</span>
              <span className="num-lg">{r.value}</span>
            </p>
          ))}
        </Link>
      )}

      {next && (
        <Link href="/mal" className="card flex items-center gap-3 py-4">
          <IconBadge icon={Medal} tone="brand" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{next.label}</span>
            <span className="block text-sm text-muted-foreground">Nästa milstolpe · {done} av {goals.milestones.length} klara</span>
          </span>
          <CaretRight size={14} weight="bold" className="text-muted-foreground" />
        </Link>
      )}
    </section>
  );
}
