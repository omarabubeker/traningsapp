"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { parseAppleHealthExport, toActivityRows, type ActivityRow } from "@/lib/appleHealth";
import { SPORT_LABEL } from "@/lib/running";
import { formatDate } from "@/lib/dates";

type Phase =
  | { kind: "idle" }
  | { kind: "reading"; pct: number; workouts: number }
  | { kind: "ready"; rows: ActivityRow[]; skipped: number }
  | { kind: "saving"; done: number; total: number }
  | { kind: "done"; saved: number }
  | { kind: "error"; message: string };

const DUPLICATE_WINDOW_MS = 120_000;

export default function ImportPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      setPhase({ kind: "reading", pct: 0, workouts: 0 });
      const { workouts, gpx } = await parseAppleHealthExport(file.stream(), file.size, (p) =>
        setPhase({ kind: "reading", pct: Math.round((p.bytes / p.total) * 100), workouts: p.workouts }),
      );
      const rows = toActivityRows(workouts, gpx);
      if (!rows.length) return setPhase({ kind: "error", message: "Hittade inga träningspass i filen. Är det rätt fil (export.zip)?" });

      // Hoppa över pass som redan finns från klockan (intervals.icu).
      const { data: existing } = await supabaseBrowser()
        .from("activities")
        .select("start_time")
        .neq("source", "apple_health")
        .is("deleted_at", null);
      const starts = ((existing ?? []) as { start_time: string }[]).map((r) => Date.parse(r.start_time));
      const fresh = rows.filter((r) => !starts.some((s) => Math.abs(s - Date.parse(r.start_time)) < DUPLICATE_WINDOW_MS));
      setPhase({ kind: "ready", rows: fresh, skipped: rows.length - fresh.length });
    } catch (e) {
      console.error(e);
      setPhase({ kind: "error", message: "Kunde inte läsa filen. Välj zip-filen som Hälsa-appen skapade (export.zip)." });
    }
  }

  async function save(rows: ActivityRow[]) {
    const supabase = supabaseBrowser();
    for (let i = 0; i < rows.length; i += 25) {
      setPhase({ kind: "saving", done: i, total: rows.length });
      const { error } = await supabase
        .from("activities")
        .upsert(rows.slice(i, i + 25), { onConflict: "user_id,source,external_id" });
      if (error) {
        console.error(error);
        return setPhase({ kind: "error", message: `Sparandet avbröts efter ${i} pass. Försök igen – redan sparade pass dubbleras inte.` });
      }
    }
    setPhase({ kind: "done", saved: rows.length });
    router.refresh();
  }

  return (
    <main className="space-y-5 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/installningar" className="-ml-2 px-2 py-2 text-muted" aria-label="Tillbaka">←</Link>
        <h1 className="text-xl font-semibold">Importera från Apple Hälsa</h1>
      </header>

      {phase.kind === "idle" && (
        <section className="card space-y-4 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-muted">
            <li>Hälsa-appen → din profilbild → <span className="text-text">Exportera all hälsodata</span>.</li>
            <li>Spara filen (export.zip) i Filer eller skicka den till datorn.</li>
            <li>Välj filen här. Den läses i din webbläsare – bara träningspassen sparas.</li>
          </ol>
          <label className="btn-primary w-full cursor-pointer">
            Välj export.zip
            <input type="file" accept=".zip,application/zip" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <p className="text-xs text-muted">Filen kan vara flera hundra MB. Det går snabbast på en dator, men fungerar även i mobilen.</p>
        </section>
      )}

      {phase.kind === "reading" && (
        <section className="card space-y-3">
          <p>Läser filen… {phase.pct} %</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent transition-all" style={{ width: `${phase.pct}%` }} />
          </div>
          <p className="text-sm text-muted">{phase.workouts} pass hittade hittills</p>
        </section>
      )}

      {phase.kind === "ready" && <Preview rows={phase.rows} skipped={phase.skipped} onSave={() => save(phase.rows)} />}

      {phase.kind === "saving" && (
        <section className="card space-y-3">
          <p>Sparar {phase.done} av {phase.total}…</p>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-accent transition-all" style={{ width: `${(phase.done / phase.total) * 100}%` }} />
          </div>
        </section>
      )}

      {phase.kind === "done" && (
        <section className="card space-y-3">
          <p className="font-medium">Klart! {phase.saved} pass importerade.</p>
          <Link href="/lopning" className="btn-primary w-full">Visa löppassen</Link>
        </section>
      )}

      {phase.kind === "error" && (
        <section className="card space-y-3">
          <p className="text-danger">{phase.message}</p>
          <button className="btn-ghost w-full" onClick={() => setPhase({ kind: "idle" })}>Försök igen</button>
        </section>
      )}
    </main>
  );
}

function Preview({ rows, skipped, onSave }: { rows: ActivityRow[]; skipped: number; onSave: () => void }) {
  const bySport = Object.entries(
    rows.reduce<Record<string, number>>((m, r) => ((m[r.sport_type] = (m[r.sport_type] ?? 0) + 1), m), {}),
  ).sort((a, b) => b[1] - a[1]);
  const sorted = [...rows].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const fmt = (s: string) => formatDate(s, { day: "numeric", month: "short", year: "numeric" });
  return (
    <section className="card space-y-4">
      <div>
        <p className="font-medium">{rows.length} pass att importera</p>
        {rows.length > 0 && <p className="text-sm text-muted">{fmt(sorted[0].start_time)} – {fmt(sorted.at(-1)!.start_time)}</p>}
        {skipped > 0 && <p className="text-sm text-muted">{skipped} finns redan från klockan och hoppas över.</p>}
      </div>
      <ul className="divide-y divide-line text-sm">
        {bySport.map(([sport, n]) => (
          <li key={sport} className="flex justify-between py-2">
            <span>{SPORT_LABEL[sport] ?? sport}</span>
            <span className="text-muted">{n}</span>
          </li>
        ))}
      </ul>
      <button className="btn-primary w-full" disabled={!rows.length} onClick={onSave}>Importera</button>
    </section>
  );
}
