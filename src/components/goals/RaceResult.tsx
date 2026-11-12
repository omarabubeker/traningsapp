"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag } from "@phosphor-icons/react/dist/ssr";
import { supabaseBrowser } from "@/lib/supabase/client";
import { parseTime, type Goal } from "@/lib/goalDef";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardHead } from "@/components/CardParts";

/** Efter loppdagen: fyll i sluttiden (eller markera att loppet inte blev av). */
export function RaceResult({ goal }: { goal: Goal }) {
  const router = useRouter();
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(skip = false) {
    const sec = parseTime(time);
    if (!skip && !sec) return toast.error("Skriv tiden som t.ex. 3:52:10.");
    setBusy(true);
    const { error } = await supabaseBrowser()
      .from("goals")
      .update(skip ? { status: "archived" } : { status: "completed", result_time_s: sec, completed_at: goal.race_date })
      .eq("id", goal.id);
    setBusy(false);
    if (error) return toast.error("Kunde inte spara.");
    router.refresh();
  }

  return (
    <section className="card space-y-4 border-brand/50">
      <CardHead icon={Flag} tone="brand" title={`Hur gick ${goal.title}?`} />
      <p className="text-sm text-muted-foreground">Fyll i din sluttid så sparas loppet i din historik.</p>
      <div className="flex gap-2">
        <Input inputMode="numeric" placeholder="3:52:10" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Sluttid" />
        <Button onClick={() => save()} disabled={busy} className="shrink-0">Spara</Button>
      </div>
      <button onClick={() => save(true)} disabled={busy} className="text-sm text-muted-foreground underline-offset-2 hover:underline">
        Jag sprang inte loppet
      </button>
    </section>
  );
}
