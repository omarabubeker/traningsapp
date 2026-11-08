import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { intervalsConfigured } from "@/lib/intervals";
import { formatDate, formatTime } from "@/lib/dates";
import { SyncButton } from "@/components/SyncButton";

export const dynamic = "force-dynamic";

export default async function Installningar() {
  const { supabase } = await requireUser();
  const [{ data: state }, { count }] = await Promise.all([
    supabase.from("sync_state").select("*").eq("provider", "intervals").maybeSingle(),
    supabase.from("activities").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);
  const configured = intervalsConfigured();
  const last = state?.last_result as { fetched?: number; created?: number } | null;

  return (
    <main className="space-y-5 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/profil" className="-ml-2 px-2 py-2 text-muted" aria-label="Tillbaka">←</Link>
        <h1 className="text-2xl font-semibold">Inställningar</h1>
      </header>

      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium">Klockan (intervals.icu)</h2>
            <p className="text-sm text-muted">
              {!configured
                ? "Inte kopplad – lägg in INTERVALS_API_KEY och INTERVALS_ATHLETE_ID i Vercel."
                : state?.last_sync_at
                  ? `Senast synkad ${formatDate(state.last_sync_at, { day: "numeric", month: "short" })} ${formatTime(state.last_sync_at)}${last?.fetched != null ? ` · ${last.fetched} pass i perioden` : ""}`
                  : "Kopplad, inte synkad än."}
            </p>
          </div>
          {configured && <SyncButton />}
        </div>
        <p className="text-xs text-muted">
          Synkar automatiskt när du öppnar appen (högst var 10:e minut). Nya pass kommer via Apple Hälsa → Intervals.icu Companion → intervals.icu.
        </p>
      </section>

      <section className="card space-y-2">
        <h2 className="font-medium">Historik från Apple Hälsa</h2>
        <p className="text-sm text-muted">Importera äldre pass från en Apple Hälsa-export. {count ?? 0} pass finns i appen nu.</p>
        <Link href="/installningar/import" className="btn-ghost w-full">Importera export.zip</Link>
      </section>
    </main>
  );
}
