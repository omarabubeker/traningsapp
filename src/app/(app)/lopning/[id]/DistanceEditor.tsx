"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = { id: string; watchDistance: number | null; override: number | null };

export function DistanceEditor({ id, watchDistance, override }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [km, setKm] = useState(((override ?? watchDistance ?? 0) / 1000).toFixed(2).replace(".", ","));
  const [error, setError] = useState<string | null>(null);

  async function save(value: number | null) {
    const { error } = await supabaseBrowser().from("activities").update({ distance_override_m: value }).eq("id", id);
    if (error) return setError("Kunde inte spara.");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full py-2 text-sm text-brand">
        {override ? "Ändra rättad distans" : "Rätta distans (t.ex. från löpbandet)"}
      </button>
    );
  }
  return (
    <form
      className="card space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(km.replace(",", "."));
        if (!n || n < 0.1 || n > 300) return setError("Ange distans i km, t.ex. 8,0.");
        save(Math.round(n * 1000));
      }}
    >
      <label className="label" htmlFor="km">Verklig distans (km)</label>
      <Input id="km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} className="text-lg" autoFocus />
      {watchDistance && <p className="text-xs text-muted-foreground">Klockan mätte {(watchDistance / 1000).toFixed(2).replace(".", ",")} km. Tempo och veckovolym räknas om.</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1">Spara</Button>
        {override && <Button type="button" onClick={() => save(null)} variant="secondary">Återställ</Button>}
        <Button type="button" onClick={() => setOpen(false)} variant="secondary">Avbryt</Button>
      </div>
    </form>
  );
}
