"use client";
// Offlinekö för gymset. Varje ändring sparas först lokalt och skickas sedan
// till Supabase i ordning. Set har klientgenererade id:n, så omförsök är säkra.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GymSet } from "./types";

export type QueueOp =
  | { kind: "upsertSet"; row: GymSet }
  | { kind: "deleteSet"; id: string };

const KEY = "gym-queue-v1";
const listeners = new Set<() => void>();
let flushing: Promise<void> | null = null;

function read(): QueueOp[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(ops: QueueOp[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    /* privat läge e.d. – kön lever då bara i minnet under sidbesöket */
  }
  listeners.forEach((l) => l());
}

export function pendingOps(): QueueOp[] {
  return read();
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function enqueue(op: QueueOp) {
  const ops = read();
  // Radering av ett set som aldrig nått servern: stryk bara uppläggningen.
  if (op.kind === "deleteSet") {
    const i = ops.findIndex((o) => o.kind === "upsertSet" && o.row.id === op.id);
    if (i >= 0) {
      ops.splice(i, 1);
      write(ops);
      return;
    }
  }
  ops.push(op);
  write(ops);
}

/** Fel som går över av sig själva (nät, utgången session, serverfel) ska försökas igen. */
function isTransient(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const code = error.code ?? "";
  if (/^\d{5}$/.test(code)) return false; // Postgres-fel, t.ex. ogiltigt värde
  if (code === "PGRST301" || code === "PGRST303") return true; // JWT
  if (code.startsWith("PGRST")) return false;
  return true; // t.ex. "Failed to fetch"
}

export function flush(supabase: SupabaseClient): Promise<void> {
  if (flushing) return flushing;
  // Obs: tilldela innan arbetet startar, annars kan `finally` köras först
  // (tom kö) och låsa kön med ett redan avklarat löfte.
  let release!: () => void;
  flushing = new Promise<void>((r) => (release = r));
  const done = flushing;
  (async () => {
    try {
      while (true) {
        const ops = read();
        const op = ops[0];
        if (!op) break;
        const { error } =
          op.kind === "upsertSet"
            ? await supabase.from("gym_sets").upsert(op.row)
            : await supabase.from("gym_sets").delete().eq("id", op.id);
        if (error && isTransient(error)) break;
        if (error) console.warn("Gymset kunde inte sparas och hoppas över", error, op);
        write(read().slice(1));
      }
    } finally {
      flushing = null;
      release();
    }
  })();
  return done;
}
