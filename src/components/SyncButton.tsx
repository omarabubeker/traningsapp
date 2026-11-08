"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { runSync } from "./AutoSync";

export function SyncButton({ className = "btn-ghost min-h-10 px-3 text-sm" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    const r = await runSync();
    setBusy(false);
    setMsg({ ok: r.ok, text: r.message });
    router.refresh();
    setTimeout(() => setMsg(null), 6000);
  }

  return (
    <div className="flex flex-col items-end">
      <button onClick={sync} disabled={busy} className={className}>
        {busy ? "Synkar…" : "Synka"}
      </button>
      {msg && <p className={`mt-1 max-w-56 text-right text-xs ${msg.ok ? "text-muted" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
