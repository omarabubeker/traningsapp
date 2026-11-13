import Link from "next/link";
import { CloudSun, MapPin, Warning } from "@phosphor-icons/react/dist/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CardHead } from "@/components/CardParts";
import { clothing, describe } from "@/lib/clothing";
import { runHour, weatherAt } from "@/lib/weather";
import { isoDay } from "@/lib/dates";

const deg = (n: number) => `${Math.round(n)}°`;

/** Väder och klädtips inför dagens löppass (hämtas för sig så att översikten inte väntar). */
export async function RunWeather({ supabase, km }: { supabase: SupabaseClient; km: number | null }) {
  const [{ data: prof }, { data: runs }] = await Promise.all([
    supabase.from("profile").select("weather_place, weather_lat, weather_lon").maybeSingle(),
    supabase.from("activities").select("start_time").ilike("sport_type", "%run%").is("deleted_at", null).order("start_time", { ascending: false }).limit(10),
  ]);
  if (prof?.weather_lat == null || prof?.weather_lon == null)
    return (
      <Link href="/installningar#vader" className="card flex items-center gap-3 py-4 active:bg-secondary">
        <MapPin size={22} weight="duotone" className="shrink-0 text-brand" />
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-semibold">Klädtips inför passet</span>
          <span className="text-muted-foreground">Välj din plats så visas väder och vad du ska ha på dig.</span>
        </span>
      </Link>
    );

  const now = new Date();
  const nowHour = Number(new Intl.DateTimeFormat("sv-SE", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Stockholm" }).format(now));
  const { hour, usual } = runHour((runs ?? []).map((r) => r.start_time), nowHour);
  const w = await weatherAt(Number(prof.weather_lat), Number(prof.weather_lon), isoDay(now), hour);
  if (!w) return null;
  const tip = clothing(w, { longRun: (km ?? 0) >= 15 });

  return (
    <div className="card space-y-3">
      <CardHead icon={CloudSun} tone="run" title="Väder och kläder" right={`kl ${String(hour).padStart(2, "0")}`} />
      <div className="flex items-baseline gap-3">
        <p className="num-xl">{deg(w.temp)}</p>
        <p className="text-sm text-muted-foreground">
          {describe(w.code)} · känns som {deg(w.feels)} · vind {Math.round(w.wind)} m/s
          {w.precipProb >= 20 ? ` · ${Math.round(w.precipProb)} % risk för nederbörd` : ""}
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {tip.items.map((i) => (
          <li key={i} className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium first-letter:uppercase">{i}</li>
        ))}
      </ul>
      {tip.notes.map((n) => (
        <p key={n} className="flex items-start gap-2 text-sm">
          <Warning size={18} weight="duotone" className="mt-px shrink-0 text-gym" />
          {n}
        </p>
      ))}
      <p className="text-xs text-muted-foreground">
        {prof.weather_place ?? "Din plats"} · kl {String(hour).padStart(2, "0")}{usual ? ", när du brukar springa" : ""} · Open-Meteo
      </p>
    </div>
  );
}
