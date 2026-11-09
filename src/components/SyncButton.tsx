"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { runSync } from "./AutoSync";
import { Button } from "@/components/ui/button";

export function SyncButton({ className }: { className?: string }) {
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
      <Button variant="secondary" size="sm" onClick={sync} disabled={busy} className={className}>
        {busy ? "Synkar…" : "Synka"}
      </Button>
      {msg && <p className={`mt-1 max-w-56 text-right text-xs ${msg.ok ? "text-muted-foreground" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}
