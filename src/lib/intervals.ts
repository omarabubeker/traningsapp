import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TrackPoint } from "./running";
import { isOwner } from "./owner";

// Klient för intervals.icu (personlig API-nyckel, Basic auth "API_KEY:<nyckel>").
// Fälten tolkas tolerant eftersom API:et kan ändras över tid.

const BASE = process.env.INTERVALS_BASE_URL ?? "https://intervals.icu/api/v1"; // går att peka om vid test

/** En persons koppling till intervals.icu. */
export type IntervalsCreds = { athleteId: string; apiKey: string };

/** "12345" eller "i12345" → "i12345" (ofta glöms "i" bort). */
export function normalizeAthleteId(id: string) {
  const t = id.trim();
  return /^i/i.test(t) ? "i" + t.slice(1) : `i${t}`;
}

/**
 * Den inloggades koppling: egen nyckel (krypterad i Supabase Vault) i första hand.
 * Reserv för appens ägare: nyckeln i Vercels miljövariabler, tills den lagts in i appen.
 */
export async function getIntervalsCreds(supabase: SupabaseClient, email?: string | null): Promise<IntervalsCreds | null> {
  const { data } = await supabase.rpc("intervals_credentials");
  const row = (data as { athlete_id: string; api_key: string }[] | null)?.[0];
  if (row?.api_key) return { athleteId: row.athlete_id, apiKey: row.api_key };
  if (isOwner(email) && process.env.INTERVALS_API_KEY && process.env.INTERVALS_ATHLETE_ID) {
    return { athleteId: normalizeAthleteId(process.env.INTERVALS_ATHLETE_ID), apiKey: process.env.INTERVALS_API_KEY.trim() };
  }
  return null;
}

async function call<T>(creds: IntervalsCreds, path: string, attempt = 0): Promise<T> {
  const auth = Buffer.from(`API_KEY:${creds.apiKey.trim()}`).toString("base64");
  const res = await fetch(BASE + path, { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }, cache: "no-store" });
  if (res.status === 429 && attempt < 3) {
    const wait = Math.min(10, Number(res.headers.get("retry-after")) || 2 ** attempt);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return call<T>(creds, path, attempt + 1);
  }
  if (!res.ok) throw new IntervalsError(res.status, await res.text().catch(() => ""));
  return res.json() as Promise<T>;
}

export class IntervalsError extends Error {
  constructor(public status: number, body: string) {
    super(`intervals.icu svarade ${status}: ${body.slice(0, 200)}`);
  }
}

type Raw = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v ? v : null);

export type IntervalsActivity = {
  external_id: string;
  sport_type: string;
  name: string | null;
  start_time: string;
  distance_m: number | null;
  moving_time_s: number | null;
  elapsed_time_s: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  elevation_gain_m: number | null;
  avg_pace_s_per_km: number | null;
  avg_cadence: number | null;
  calories: number | null;
  training_load: number | null;
  indoor: boolean;
  source_updated_at: string | null;
};

export function mapActivity(a: Raw): IntervalsActivity | null {
  const id = a.id != null ? String(a.id) : null;
  const start = str(a.start_date) ?? str(a.start_date_local);
  // Pass från Strava levereras utan data via API:et – hoppa över dem.
  if (!id || !start || (a.source === "STRAVA" && a.distance == null && a.moving_time == null)) return null;
  const distance = num(a.distance);
  const moving = num(a.moving_time);
  const startIso = /[zZ]|[+-]\d\d:?\d\d$/.test(start) ? start : start + "Z";
  return {
    external_id: id,
    sport_type: str(a.type) ?? "Other",
    name: str(a.name),
    start_time: new Date(startIso).toISOString(),
    distance_m: distance,
    moving_time_s: moving,
    elapsed_time_s: num(a.elapsed_time),
    avg_hr: num(a.average_heartrate) ?? num(a.icu_average_hr),
    max_hr: num(a.max_heartrate) ?? num(a.icu_max_hr),
    elevation_gain_m: num(a.total_elevation_gain),
    avg_pace_s_per_km: distance && moving ? Math.round((moving / distance) * 1000 * 10) / 10 : null,
    avg_cadence: num(a.average_cadence),
    calories: num(a.calories),
    training_load: num(a.icu_training_load),
    indoor: a.trainer === true,
    source_updated_at: str(a.icu_sync_date) ?? str(a.updated) ?? null,
  };
}

export async function listActivities(creds: IntervalsCreds, oldest: string, newest: string) {
  const raw = await call<Raw[]>(creds, `/athlete/${creds.athleteId}/activities?oldest=${oldest}&newest=${newest}T23:59:59`);
  return raw.map(mapActivity).filter((x): x is IntervalsActivity => !!x);
}

type Stream = { type: string; data?: unknown[]; data2?: unknown[] };

/** Hämtar tidsserier och gör om dem till spårpunkter. */
export async function getTrack(creds: IntervalsCreds, activityId: string): Promise<TrackPoint[]> {
  const streams = await call<Stream[]>(
    creds,
    `/activity/${encodeURIComponent(activityId)}/streams.json?types=time,distance,heartrate,altitude,latlng`,
  );
  const by = Object.fromEntries(streams.map((s) => [s.type, s]));
  const time = (by.time?.data ?? []) as number[];
  if (!time.length) return [];
  const dist = by.distance?.data as number[] | undefined;
  const hr = by.heartrate?.data as number[] | undefined;
  const alt = (by.altitude?.data ?? by.fixed_altitude?.data) as number[] | undefined;
  const ll = by.latlng;
  return time.map((t, i) => {
    let lat: number | undefined, lng: number | undefined;
    if (ll?.data) {
      const v = ll.data[i];
      if (Array.isArray(v)) [lat, lng] = v as number[];
      else if (typeof v === "number" && ll.data2) [lat, lng] = [v, ll.data2[i] as number];
    }
    return {
      t,
      d: dist?.[i] ?? undefined,
      hr: hr?.[i] || undefined,
      ele: alt?.[i] ?? undefined,
      lat: lat || undefined,
      lng: lng || undefined,
    };
  });
}

export type Wellness = { id: string; restingHR: number | null; hrv: number | null; sleepSecs: number | null };

/** Dagliga återhämtningsvärden (vilopuls, HRV, sömn) – om de synkas från klockan. */
export async function listWellness(creds: IntervalsCreds, oldest: string, newest: string): Promise<Wellness[]> {
  const raw = await call<Raw[]>(creds, `/athlete/${creds.athleteId}/wellness?oldest=${oldest}&newest=${newest}`);
  return raw.map((w) => ({
    id: String(w.id ?? ""),
    restingHR: num(w.restingHR),
    hrv: num(w.hrv) ?? num(w.hrvSDNN),
    sleepSecs: num(w.sleepSecs),
  }));
}

/** Kontrollerar en nyckel: hämtar profilen hos intervals.icu. Returnerar namnet. */
export async function verifyCreds(creds: IntervalsCreds): Promise<{ name: string | null }> {
  const a = await call<Raw>(creds, `/athlete/${creds.athleteId}`);
  return { name: str(a.name) };
}
