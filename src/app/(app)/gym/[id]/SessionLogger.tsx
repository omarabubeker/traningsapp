"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { enqueue, flush, pendingOps, subscribe } from "@/lib/gymQueue";
import { formatDate, formatKg, formatTime } from "@/lib/dates";
import type { Exercise, GymSession, GymSet } from "@/lib/types";
import { Stepper } from "./Stepper";
import { MoreMenu } from "@/components/MoreMenu";
import { GymSessionSkeleton } from "@/components/Skeletons";
import { confirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { ExercisePicker } from "./ExercisePicker";
import { Button } from "@/components/ui/button";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

type Prev = { date: string; sets: GymSet[] };

/** Seten från senaste tidigare pass med samma övning (vanlig tabellfråga, ingen databasfunktion). */
async function fetchPrev(supabase: ReturnType<typeof supabaseBrowser>, exId: string, sessionId: string): Promise<Prev | null> {
  const { data, error } = await supabase
    .from("gym_sets")
    .select("*, gym_sessions!inner(started_at)")
    .eq("exercise_id", exId)
    .neq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) {
    console.warn("Kunde inte hämta förra gången", error);
    return null;
  }
  const rows = (data ?? []) as (GymSet & { gym_sessions: { started_at: string } })[];
  if (!rows.length) return null;
  const last = rows[0].session_id;
  const sets = rows
    .filter((r) => r.session_id === last)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((r) => {
      const { gym_sessions, ...set } = r;
      void gym_sessions;
      return set as GymSet;
    });
  return { date: rows[0].gym_sessions.started_at, sets };
}

export function SessionLogger({ sessionId }: { sessionId: string }) {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [session, setSession] = useState<GymSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [serverSets, setServerSets] = useState<GymSet[]>([]);
  const [queueVersion, setQueueVersion] = useState(0);
  const [activeEx, setActiveEx] = useState<string | null>(null);
  const [weight, setWeight] = useState(20);
  const [reps, setReps] = useState(8);
  const [prev, setPrev] = useState<Record<string, Prev | null>>({});
  const [picker, setPicker] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState<string | null>(null);
  const [watch, setWatch] = useState<{ minutes: number; hr: number | null; maxHr: number | null; kcal: number | null } | null>(null);

  // --- Ladda pass, övningar och set -----------------------------------------
  useEffect(() => {
    (async () => {
      const [s, ex, sets] = await Promise.all([
        supabase.from("gym_sessions").select("*").eq("id", sessionId).maybeSingle(),
        supabase.from("exercises").select("*").eq("archived", false).order("name"),
        supabase.from("gym_sets").select("*").eq("session_id", sessionId).order("created_at"),
      ]);
      if (s.error || !s.data) {
        setLoadError(navigator.onLine ? "Passet hittades inte." : "Ingen uppkoppling.");
        return;
      }
      setSession(s.data);
      setExercises(ex.data ?? []);
      // Styrkepass från klockan under samma tid (puls och kalorier).
      const from = new Date(Date.parse(s.data.started_at) - 30 * 60e3).toISOString();
      const to = new Date((s.data.ended_at ? Date.parse(s.data.ended_at) : Date.parse(s.data.started_at) + 3 * 3600e3) + 30 * 60e3).toISOString();
      supabase
        .from("activities")
        .select("moving_time_s, elapsed_time_s, avg_hr, max_hr, calories, sport_type")
        .in("sport_type", ["Strength", "WeightTraining"])
        .is("deleted_at", null)
        .gte("start_time", from)
        .lte("start_time", to)
        .limit(1)
        .maybeSingle()
        .then(({ data }: { data: unknown }) => {
          const w = data as { moving_time_s: number | null; elapsed_time_s: number | null; avg_hr: number | null; max_hr: number | null; calories: number | null } | null;
          if (w) setWatch({ minutes: Math.round((w.elapsed_time_s ?? w.moving_time_s ?? 0) / 60), hr: w.avg_hr, maxHr: w.max_hr, kcal: w.calories });
        });
      setServerSets(sets.data ?? []);
      const last = (sets.data ?? []).at(-1);
      if (last) {
        setActiveEx(last.exercise_id);
        setWeight(Number(last.weight_kg));
        setReps(last.reps);
        const r = await fetchPrev(supabase, last.exercise_id, sessionId);
        setPrev((p) => ({ ...p, [last.exercise_id]: r }));
      }
    })();
  }, [sessionId, supabase]);

  // --- Offlinekö -------------------------------------------------------------
  useEffect(() => {
    const unsub = subscribe(() => setQueueVersion((v) => v + 1));
    const tryFlush = () => flush(supabase);
    tryFlush();
    window.addEventListener("online", tryFlush);
    document.addEventListener("visibilitychange", tryFlush);
    const t = setInterval(tryFlush, 20000);
    return () => {
      unsub();
      window.removeEventListener("online", tryFlush);
      document.removeEventListener("visibilitychange", tryFlush);
      clearInterval(t);
    };
  }, [supabase]);

  const { sets, pendingIds } = useMemo(() => {
    void queueVersion;
    const ops = typeof window === "undefined" ? [] : pendingOps();
    const deleted = new Set(ops.flatMap((o) => (o.kind === "deleteSet" ? [o.id] : [])));
    const pending = ops.flatMap((o) => (o.kind === "upsertSet" && o.row.session_id === sessionId ? [o.row] : []));
    const byId = new Map(serverSets.map((s) => [s.id, s]));
    pending.forEach((p) => byId.set(p.id, p));
    const all = [...byId.values()]
      .filter((s) => !deleted.has(s.id))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return { sets: all, pendingIds: new Set(pending.map((p) => p.id)) };
  }, [serverSets, queueVersion, sessionId]);

  // --- Håll skärmen vaken under passet (iOS 16.4+, Android, desktop) ----------
  const ended = !!session?.ended_at;
  useEffect(() => {
    if (!session || ended || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [session, ended]);

  // --- Vilotimer -------------------------------------------------------------
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const lastSetAt = sets.at(-1)?.created_at;
  const restSec = lastSetAt ? Math.max(0, Math.floor((now - new Date(lastSetAt).getTime()) / 1000)) : null;

  // --- Förra gången ------------------------------------------------------------
  const loadPrev = useCallback(
    async (exId: string) => {
      if (exId in prev) return prev[exId];
      const result = await fetchPrev(supabase, exId, sessionId);
      setPrev((p) => ({ ...p, [exId]: result }));
      return result;
    },
    [prev, supabase, sessionId],
  );

  async function selectExercise(exId: string) {
    setActiveEx(exId);
    setPicker(false);
    const ex = exercises.find((e) => e.id === exId);
    const inSession = sets.filter((s) => s.exercise_id === exId);
    const lastHere = inSession.at(-1);
    if (lastHere) {
      setWeight(Number(lastHere.weight_kg));
      setReps(lastHere.reps);
      return;
    }
    const p = await loadPrev(exId);
    const first = p?.sets.find((s) => !s.is_warmup) ?? p?.sets[0];
    if (first) {
      setWeight(Number(first.weight_kg));
      setReps(first.reps);
    } else {
      setWeight(ex?.is_bodyweight ? 0 : 20);
      setReps(8);
    }
  }

  // --- Åtgärder ------------------------------------------------------------------
  function saveSet() {
    if (!activeEx) return;
    const row: GymSet = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      exercise_id: activeEx,
      set_no: sets.filter((s) => s.exercise_id === activeEx).length + 1,
      reps,
      weight_kg: weight,
      rpe: null,
      is_warmup: false,
      created_at: new Date().toISOString(),
    };
    // Visas direkt; markeras som väntande tills kön skickats.
    enqueue({ kind: "upsertSet", row });
    setServerSets((xs) => [...xs, row]);
    flush(supabase).then(() => router.refresh());
  }

  async function removeSet(s: GymSet) {
    if (!(await confirmDialog({ title: "Ta bort setet?", description: `${formatKg(s.weight_kg)} kg × ${s.reps}`, confirmLabel: "Ta bort", danger: true }))) return;
    setServerSets((xs) => xs.filter((x) => x.id !== s.id));
    enqueue({ kind: "deleteSet", id: s.id });
    flush(supabase).then(() => router.refresh());
  }

  async function createExercise(name: string) {
    const { data, error } = await supabase.from("exercises").insert({ name }).select().single();
    if (error) {
      setMessage(error.code === "23505" ? "Övningen finns redan." : "Kunde inte skapa övningen (kräver nät).");
      return;
    }
    setExercises((xs) => [...xs, data].sort((a, b) => a.name.localeCompare(b.name, "sv")));
    setPrev((p) => ({ ...p, [data.id]: null }));
    selectExercise(data.id);
  }

  async function finish() {
    await flush(supabase);
    if (pendingOps().length) {
      setMessage("Några set väntar fortfarande på uppkoppling. De skickas automatiskt.");
    }
    const { error } = await supabase.from("gym_sessions").update({ ended_at: new Date().toISOString() }).eq("id", sessionId);
    if (error) {
      setMessage("Kunde inte avsluta passet just nu – försök igen när du har nät.");
      return;
    }
    router.push("/gym");
    router.refresh();
  }

  async function reopen() {
    const { error } = await supabase.from("gym_sessions").update({ ended_at: null }).eq("id", sessionId);
    if (!error) setSession((s) => (s ? { ...s, ended_at: null } : s));
  }

  async function deleteSession() {
    if (!(await confirmDialog({ title: "Radera passet?", description: "Hela passet och alla dess set tas bort.", confirmLabel: "Radera", danger: true }))) return;
    const { error } = await supabase.from("gym_sessions").delete().eq("id", sessionId);
    if (error) return void toast.error("Kunde inte radera passet.");
    toast.success("Passet är raderat");
    router.push("/gym");
    router.refresh();
  }

  // --- Vy ------------------------------------------------------------------------
  if (loadError) {
    return (
      <main className="space-y-4 pt-6">
        <p>{loadError}</p>
        <Button asChild variant="secondary"><Link href="/gym">Tillbaka</Link></Button>
      </main>
    );
  }
  if (!session) return <GymSessionSkeleton />;

  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? "Övning";
  const groups = [...new Set(sets.map((s) => s.exercise_id))];
  if (activeEx && !groups.includes(activeEx)) groups.push(activeEx);
  const active = activeEx ? exercises.find((e) => e.id === activeEx) : null;
  const activePrev = activeEx ? prev[activeEx] : undefined;
  const pendingCount = pendingIds.size;

  return (
    <main className="pt-3">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link href="/gym" className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Tillbaka"><CaretLeft size={22} weight="bold" /></Link>
        <div className="flex-1">
          <h1 className="h-detail inline-block first-letter:uppercase">{formatDate(session.started_at)}</h1>
          <p className="text-xs text-muted-foreground">
            {ended ? `Avslutat ${formatTime(session.ended_at!)}` : `Startat ${formatTime(session.started_at)}`}
            {pendingCount > 0 && <span className="ml-2 text-gym">· {pendingCount} väntar på nät</span>}
          </p>
        </div>
        {ended ? (
          <Button onClick={reopen} variant="secondary" size="sm">Fortsätt logga</Button>
        ) : (
          <Button onClick={finish} variant="secondary" size="sm">Avsluta</Button>
        )}
        <MoreMenu items={[{ label: "Radera pass", onSelect: deleteSession, danger: true }]} />
      </header>

      {watch && (
        <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
          ⌚ Klockan: {watch.minutes} min{watch.hr ? ` · snittpuls ${watch.hr}` : ""}{watch.maxHr ? ` (max ${watch.maxHr})` : ""}{watch.kcal ? ` · ${watch.kcal} kcal` : ""}
        </p>
      )}

      {message && (
        <p className="mb-3 rounded-xl bg-surface-2 p-3 text-sm" onClick={() => setMessage(null)}>{message}</p>
      )}

      <section className="space-y-3">
        {groups.map((exId) => {
          const exSets = sets.filter((s) => s.exercise_id === exId);
          const isActive = exId === activeEx && !ended;
          return (
            <div
              key={exId}
              className={`card transition ${isActive ? "border-brand/60" : ""}`}
              onClick={() => !ended && !isActive && selectExercise(exId)}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="h-card">{exName(exId)}</h2>
                <span className="text-xs text-muted-foreground">{exSets.length} set</span>
              </div>
              {exSets.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {exSets.map((s, i) => (
                    <li key={s.id}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSet(s);
                        }}
                        className={`rounded-lg bg-surface-2 px-3 py-1.5 text-sm ${pendingIds.has(s.id) ? "opacity-60" : ""}`}
                      >
                        <span className="mr-1 text-muted-foreground">{i + 1}.</span>
                        {s.duration_s ? `${s.duration_s} s` : `${formatKg(s.weight_kg)} × ${s.reps}`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <p className="card text-muted-foreground">Välj en övning för att börja logga.</p>}
      </section>

      {!ended && (
        <Button onClick={() => setPicker(true)} variant="secondary" className="mt-3 w-full">+ Lägg till övning</Button>
      )}


      {/* Inmatningspanel – fast längst ner för tummen */}
      {!ended && active && (
        <>
          <div className="h-80" />
          <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur">
            <div className="mx-auto max-w-md space-y-3 px-4 pt-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-medium">{active.name}</p>
                {restSec !== null && (
                  <p className="shrink-0 text-sm text-muted-foreground">
                    Vila <span className="text-text tabular-nums">{Math.floor(restSec / 60)}:{String(restSec % 60).padStart(2, "0")}</span>
                  </p>
                )}
              </div>
              <p className="min-h-5 truncate text-sm text-muted-foreground">
                {activePrev === undefined
                  ? " "
                  : activePrev
                    ? <>Förra gången ({formatDate(activePrev.date, { day: "numeric", month: "short" })}): {activePrev.sets.map((s) => `${formatKg(s.weight_kg)}×${s.reps}`).join(" · ")}</>
                    : "Första gången du gör övningen."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Stepper label={active.is_bodyweight ? "Extra vikt (kg)" : "Vikt (kg)"} value={weight} step={2.5} min={0} decimals onChange={setWeight} />
                <Stepper label="Reps" value={reps} step={1} min={0} onChange={setReps} />
              </div>
              <Button onClick={saveSet} size="lg" className="w-full">Spara set</Button>
            </div>
          </div>
        </>
      )}

      <ExercisePicker
        open={picker}
        exercises={exercises}
        onPick={selectExercise}
        onCreate={createExercise}
        onClose={() => setPicker(false)}
      />
    </main>
  );
}
