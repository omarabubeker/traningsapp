import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { intervalsConfigured } from "@/lib/intervals";
import { formatDate, formatTime } from "@/lib/dates";
import { SyncButton } from "@/components/SyncButton";
import { USD_TO_SEK } from "@/lib/coach/pricing";
import { Button } from "@/components/ui/button";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function Installningar() {
  const { supabase } = await requireUser();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const [{ data: state }, { count }, { data: usage }] = await Promise.all([
    supabase.from("sync_state").select("*").eq("provider", "intervals").maybeSingle(),
    supabase.from("activities").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("llm_usage").select("kind, cost_usd, created_at").gte("created_at", prevStart.toISOString()),
  ]);
  const rows = (usage ?? []).map((u) => ({ ...u, cost: Number(u.cost_usd), thisMonth: u.created_at >= monthStart.toISOString() }));
  const sum = (xs: typeof rows) => xs.reduce((s, x) => s + x.cost, 0);
  const cur = rows.filter((r) => r.thisMonth);
  const byKind = (k: string) => cur.filter((r) => r.kind === k);
  const money = (usd: number) => `${(usd * USD_TO_SEK).toLocaleString("sv-SE", { maximumFractionDigits: 2 })} kr`;
  const configured = intervalsConfigured();
  const last = state?.last_result as { fetched?: number; created?: number } | null;

  return (
    <main className="space-y-7 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/profil" className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Tillbaka"><CaretLeft size={22} weight="bold" /></Link>
        <h1 className="h-detail">Inställningar</h1>
      </header>

      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="h-card">Klockan (intervals.icu)</h2>
            <p className="text-sm text-muted-foreground">
              {!configured
                ? "Inte kopplad – lägg in INTERVALS_API_KEY och INTERVALS_ATHLETE_ID i Vercel."
                : state?.last_sync_at
                  ? `Senast synkad ${formatDate(state.last_sync_at, { day: "numeric", month: "short" })} ${formatTime(state.last_sync_at)}${last?.fetched != null ? ` · ${last.fetched} pass i perioden` : ""}`
                  : "Kopplad, inte synkad än."}
            </p>
          </div>
          {configured && <SyncButton />}
        </div>
        <p className="text-xs text-muted-foreground">
          Synkar automatiskt när du öppnar appen (högst var 10:e minut). Nya pass kommer via Apple Hälsa → Intervals.icu Companion → intervals.icu.
        </p>
      </section>

      <section className="card space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="h-card">Coachens förbrukning</h2>
          <p className="text-lg font-semibold">{money(sum(cur))}</p>
        </div>
        <ul className="divide-y divide-line text-sm">
          <li className="flex justify-between py-2"><span className="text-muted-foreground">Chattfrågor ({byKind("chat").length})</span><span>{money(sum(byKind("chat")))}</span></li>
          <li className="flex justify-between py-2"><span className="text-muted-foreground">Veckoavstämningar ({byKind("weekly").length})</span><span>{money(sum(byKind("weekly")))}</span></li>
          <li className="flex justify-between py-2"><span className="text-muted-foreground">Minnesanteckningar</span><span>{money(sum(byKind("memory")))}</span></li>
          <li className="flex justify-between py-2"><span className="text-muted-foreground">Förra månaden</span><span>{money(sum(rows.filter((r) => !r.thisMonth)))}</span></li>
        </ul>
        <p className="text-xs text-muted-foreground">Denna månad, ungefärligt (1 USD ≈ {USD_TO_SEK} kr). Exakt belopp och månadsgräns finns i Claude Console.</p>
      </section>

      <section className="card space-y-2">
        <h2 className="h-card">Historik från Apple Hälsa</h2>
        <p className="text-sm text-muted-foreground">Importera äldre pass från en Apple Hälsa-export. {count ?? 0} pass finns i appen nu.</p>
        <Button asChild variant="secondary" className="w-full"><Link href="/installningar/import">Importera export.zip</Link></Button>
      </section>
    </main>
  );
}
