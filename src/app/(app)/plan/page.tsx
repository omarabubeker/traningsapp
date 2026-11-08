import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { loadPlans } from "@/lib/coach/planData";
import { weekNumber } from "@/lib/dates";
import { PlanItemCard } from "@/components/PlanItemCard";
import { Markdown } from "@/components/Markdown";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const { supabase } = await requireUser();
  const { plans } = await loadPlans(supabase);

  return (
    <main className="space-y-6 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/coach" className="-ml-2 px-2 py-2 text-muted" aria-label="Tillbaka">←</Link>
        <h1 className="text-2xl font-semibold">Plan</h1>
      </header>

      {plans.length === 0 && (
        <div className="card space-y-3">
          <p className="text-muted">Ingen plan än. Gör en veckoavstämning med coachen så skapas nästa veckas plan.</p>
          <Link href="/coach" className="btn-primary w-full">Till coachen</Link>
        </div>
      )}

      {plans.map((p) => {
        const runs = p.items.filter((i) => i.kind === "run");
        const km = runs.reduce((s, i) => s + (Number((i.target as { distance_km?: number } | null)?.distance_km) || 0), 0);
        const done = p.items.filter((i) => i.status === "done").length;
        const planned = p.items.filter((i) => i.kind !== "rest").length;
        return (
          <section key={p.id} className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">Vecka {weekNumber(p.week_start)}</h2>
              <p className="text-sm text-muted">
                {runs.length} löppass{km ? ` · ca ${Math.round(km)} km` : ""} · {p.items.filter((i) => i.kind === "gym").length} gympass · {done}/{planned} klara
              </p>
            </div>
            {p.focus && <p className="card text-sm"><span className="text-muted">Fokus: </span>{p.focus}</p>}
            {p.items.map((it) => <PlanItemCard key={it.id} item={it} status={it.status} />)}
            {p.summary && (
              <details className="card text-sm">
                <summary className="cursor-pointer text-muted">Coachens genomgång</summary>
                <div className="mt-2"><Markdown text={p.summary} /></div>
              </details>
            )}
          </section>
        );
      })}
    </main>
  );
}
