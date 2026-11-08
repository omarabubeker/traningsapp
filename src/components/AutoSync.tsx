"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const KEY = "last-sync-at";
const MIN_INTERVAL_MS = 10 * 60 * 1000;
let running = false;

/** Kör synk mot klockan, upprepar medan fler pass behöver detaljer. */
export async function runSync(): Promise<{ ok: boolean; message: string; changed: boolean }> {
  if (running) return { ok: true, message: "Synk pågår redan", changed: false };
  running = true;
  let changed = false;
  try {
    for (let i = 0; i < 8; i++) {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, message: body.error ?? "Synk misslyckades", changed };
      changed ||= body.created > 0 || body.removed > 0 || i > 0;
      if (!body.pending) {
        try { localStorage.setItem(KEY, String(Date.now())); } catch {}
        return { ok: true, message: body.created ? `${body.created} nya pass` : "Allt är synkat", changed };
      }
    }
    return { ok: true, message: "Synkar fortfarande – fortsätter nästa gång", changed: true };
  } finally {
    running = false;
  }
}

/** Startar synk i bakgrunden när appen öppnas (högst var 10:e minut). */
export function AutoSync() {
  const router = useRouter();
  useEffect(() => {
    let last = 0;
    try { last = Number(localStorage.getItem(KEY) ?? 0); } catch {}
    if (Date.now() - last < MIN_INTERVAL_MS || !navigator.onLine) return;
    runSync().then((r) => r.changed && router.refresh());
  }, [router]);
  return null;
}
