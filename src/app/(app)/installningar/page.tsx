import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import { getIntervalsCreds } from "@/lib/intervals";
import { WatchConnect, type WatchStatus } from "@/components/WatchConnect";
import { formatDate, formatTime } from "@/lib/dates";
import { SyncButton } from "@/components/SyncButton";
import { Button } from "@/components/ui/button";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function Installningar() {
  const { supabase, user } = await requireUser();
  const [{ data: state }, { count }] = await Promise.all([
    supabase.from("sync_state").select("*").eq("provider", "intervals").maybeSingle(),
    supabase.from("activities").select("id", { count: "exact", head: true }).is("deleted_at", null),
  ]);
  const [{ data: conn }, creds] = await Promise.all([
    supabase.from("watch_connections").select("athlete_id, athlete_name, brand").maybeSingle(),
    getIntervalsCreds(supabase, user.email),
  ]);
  const configured = !!creds;
  const watch: WatchStatus = conn
    ? { source: "own", athleteId: conn.athlete_id, name: conn.athlete_name, brand: conn.brand }
    : { source: creds ? "env" : null };
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
                ? "Inte kopplad än – följ stegen nedan."
                : state?.last_sync_at
                  ? `Senast synkad ${formatDate(state.last_sync_at, { day: "numeric", month: "short" })} ${formatTime(state.last_sync_at)}${last?.fetched != null ? ` · ${last.fetched} pass i perioden` : ""}`
                  : "Kopplad, inte synkad än."}
            </p>
          </div>
          {configured && <SyncButton />}
        </div>
        <WatchConnect status={watch} />
        <p className="text-xs text-muted-foreground">
          Synkar automatiskt när du öppnar appen (högst var 10:e minut). Passen går från klockan till intervals.icu och sedan hit.
        </p>
      </section>


      <section className="card space-y-2">
        <h2 className="h-card">Historik från Apple Hälsa</h2>
        <p className="text-sm text-muted-foreground">Importera äldre pass från en Apple Hälsa-export. {count ?? 0} pass finns i appen nu.</p>
        <Button asChild variant="secondary" className="w-full"><Link href="/installningar/import">Importera export.zip</Link></Button>
      </section>
    </main>
  );
}
