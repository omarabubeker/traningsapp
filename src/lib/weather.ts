import "server-only";
import type { Weather } from "./clothing";

// Open-Meteo: gratis väderprognos utan nyckel. Går att peka om vid test.
const BASE = process.env.OPEN_METEO_URL ?? "https://api.open-meteo.com/v1/forecast";

type Raw = {
  hourly?: { time: string[]; temperature_2m: number[]; apparent_temperature: number[]; precipitation_probability: number[]; precipitation: number[]; wind_speed_10m: number[]; weather_code: number[] };
  daily?: { time: string[]; sunrise: string[]; sunset: string[] };
};

/** Vädret en viss timme ("2026-11-13", 7) på en plats, eller null om det inte gick att hämta. */
export async function weatherAt(lat: number, lon: number, day: string, hour: number): Promise<Weather | null> {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "temperature_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,weather_code",
    daily: "sunrise,sunset",
    wind_speed_unit: "ms",
    timezone: "Europe/Stockholm",
    forecast_days: "2",
  });
  try {
    const res = await fetch(`${BASE}?${q}`, { next: { revalidate: 1800 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const r = (await res.json()) as Raw;
    const h = r.hourly;
    const key = `${day}T${String(hour).padStart(2, "0")}:00`;
    const i = h?.time.indexOf(key) ?? -1;
    if (!h || i < 0) return null;
    const d = r.daily?.time.indexOf(day) ?? -1;
    const sunrise = d >= 0 ? r.daily!.sunrise[d] : null;
    const sunset = d >= 0 ? r.daily!.sunset[d] : null;
    return {
      hour: key,
      temp: h.temperature_2m[i],
      feels: h.apparent_temperature[i],
      wind: h.wind_speed_10m[i],
      precipProb: h.precipitation_probability[i] ?? 0,
      precip: h.precipitation[i] ?? 0,
      code: h.weather_code[i],
      // Mörkt om passet börjar före gryningen eller slutar efter skymningen (räknar med en timme).
      dark: !!sunrise && !!sunset && (key < sunrise.slice(0, 16) || `${day}T${String(hour + 1).padStart(2, "0")}:00` > sunset.slice(0, 16)),
    };
  } catch {
    return null;
  }
}

/** Vilken timme passet troligen blir: när du brukar springa, annars nästa hela timme. */
export function runHour(recentStarts: string[], nowHour: number) {
  const hours = recentStarts
    .map((s) => Number(new Intl.DateTimeFormat("sv-SE", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Stockholm" }).format(new Date(s))))
    .sort((a, b) => a - b);
  const usual = hours.length >= 3 ? hours[Math.floor(hours.length / 2)] : null;
  if (usual !== null && usual >= nowHour) return { hour: usual, usual: true };
  return { hour: Math.min(23, nowHour + 1), usual: false };
}
