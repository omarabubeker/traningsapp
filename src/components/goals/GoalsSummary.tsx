import Link from "next/link";
import type { Goals } from "@/lib/goalsData";
import { WeekRings } from "./WeekRings";

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
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Veckans mål</h2>
        <Link href="/mal" className="text-sm text-brand">Mål och rekord →</Link>
      </div>

      <div className="card space-y-3">
        {goals.rings ? (
          <WeekRings rings={goals.rings} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Ingen plan den här veckan ({sv(goals.weekKm)} km hittills). Gör en veckoavstämning med coachen för att få veckans mål.
          </p>
        )}
        <p className="flex items-center gap-2 border-t border-border pt-3 text-sm">
          <span aria-hidden>{goals.streak.current > 0 ? "🔥" : "○"}</span>
          <span className={goals.streak.current > 0 ? "" : "text-muted-foreground"}>{streakText(goals.streak.current)}</span>
        </p>
      </div>

      {fresh.length > 0 && (
        <Link href="/mal" className="card block space-y-1 border-gym/50">
          <p className="font-medium">🏆 {fresh.length === 1 ? "Nytt rekord!" : "Nya rekord!"}</p>
          {fresh.map((r) => (
            <p key={r.key} className="flex justify-between gap-2 text-sm">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="tabular-nums">{r.value}</span>
            </p>
          ))}
        </Link>
      )}

      {next && (
        <Link href="/mal" className="card flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">Nästa milstolpe · {done} av {goals.milestones.length} klara</span>
            <span className="block truncate font-medium">{next.label}</span>
          </span>
          <span className="text-muted-foreground">→</span>
        </Link>
      )}
    </section>
  );
}
