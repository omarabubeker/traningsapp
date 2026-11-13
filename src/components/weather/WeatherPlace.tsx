"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Crosshair, MagnifyingGlass, MapPin } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabaseBrowser } from "@/lib/supabase/client";

type Hit = { name: string; admin1?: string; country?: string; latitude: number; longitude: number };
const round = (n: number) => Math.round(n * 1000) / 1000; // ~100 m räcker för väder

/** Plats för väder och klädtips: sök en ort eller använd telefonens position. */
export function WeatherPlace({ userId, place }: { userId: string; place: string | null }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(name: string, lat: number, lon: number) {
    setBusy(true);
    const { error } = await supabaseBrowser()
      .from("profile")
      .upsert({ user_id: userId, weather_place: name.slice(0, 80), weather_lat: round(lat), weather_lon: round(lon) }, { onConflict: "user_id" });
    setBusy(false);
    if (error) return toast.error("Kunde inte spara platsen.");
    setHits(null);
    setQ("");
    toast.success(`Väder för ${name}`);
    router.refresh();
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=5&language=sv&format=json&name=${encodeURIComponent(q.trim())}`);
      const body = (await res.json()) as { results?: Hit[] };
      setHits(body.results ?? []);
    } catch {
      toast.error("Kunde inte söka just nu.");
    }
    setBusy(false);
  }

  function locate() {
    if (!navigator.geolocation) return toast.error("Telefonen delar inte position här.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => save("Min position", p.coords.latitude, p.coords.longitude),
      () => {
        setBusy(false);
        toast.error("Fick ingen position – sök på din ort i stället.");
      },
      { maximumAge: 3600_000, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm">
        <MapPin size={18} weight="duotone" className="shrink-0 text-brand" />
        {place ? <span>Väder för <b>{place}</b></span> : <span className="text-muted-foreground">Ingen plats vald</span>}
      </p>
      <form onSubmit={search} className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök ort, t.ex. Uppsala" enterKeyHint="search" />
        <Button type="submit" variant="secondary" size="icon" disabled={busy} aria-label="Sök">
          <MagnifyingGlass size={20} />
        </Button>
      </form>
      {hits && (
        <ul className="divide-y divide-border rounded-2xl bg-secondary/60">
          {hits.length === 0 && <li className="px-3 py-2.5 text-sm text-muted-foreground">Hittade ingen ort med det namnet.</li>}
          {hits.map((h) => (
            <li key={`${h.latitude},${h.longitude}`}>
              <button type="button" disabled={busy} onClick={() => save(h.name, h.latitude, h.longitude)} className="w-full px-3 py-2.5 text-left active:bg-secondary">
                <span className="block font-medium">{h.name}</span>
                <span className="block text-xs text-muted-foreground">{[h.admin1, h.country].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="ghost" className="w-full" disabled={busy} onClick={locate}>
        <Crosshair size={18} /> Använd min position
      </Button>
      <p className="text-xs text-muted-foreground">Positionen sparas avrundad och används bara för väderprognosen.</p>
    </div>
  );
}
