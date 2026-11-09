"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function StartSessionButton({ className = "w-full" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const id = crypto.randomUUID();
    const { error } = await supabaseBrowser().from("gym_sessions").insert({ id });
    if (error) {
      setBusy(false);
      setError(navigator.onLine ? "Kunde inte starta passet." : "Ingen uppkoppling – försök igen när du har nät.");
      return;
    }
    router.push(`/gym/${id}`);
  }

  return (
    <>
      <Button onClick={start} disabled={busy} className={className}>
        {busy ? "Startar…" : "Starta gympass"}
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </>
  );
}
