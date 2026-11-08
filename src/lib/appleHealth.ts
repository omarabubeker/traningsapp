// Läser en Apple Hälsa-export (export.zip) strömmande i webbläsaren.
// Bara träningspass och deras GPS-rutter plockas ut; inget skickas någonstans härifrån.
import { Unzip, UnzipInflate } from "fflate";
import { SaxesParser } from "saxes";
import { computeSplits, elevationGain, simplifyRoute, withDistance, type TrackPoint } from "./running";

type RawWorkout = {
  attrs: Record<string, string>;
  stats: Record<string, Record<string, string>>;
  meta: Record<string, string>;
  routePath: string | null;
};

export type ActivityRow = {
  source: "apple_health";
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
  calories: number | null;
  indoor: boolean;
  splits: ReturnType<typeof computeSplits> | null;
  route: [number, number][] | null;
  details_fetched: boolean;
};

const TYPE_MAP: Record<string, string> = {
  Running: "Run",
  Walking: "Walk",
  Hiking: "Hike",
  Cycling: "Ride",
  TraditionalStrengthTraining: "Strength",
  FunctionalStrengthTraining: "Strength",
  HighIntensityIntervalTraining: "HIIT",
  Swimming: "Swim",
  CrossTraining: "CrossTraining",
  Yoga: "Yoga",
};

/** "2026-11-05 19:16:42 +0100" → ISO-sträng. */
export function appleDate(s: string): string {
  const m = s.match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ([+-]\d\d)(\d\d)$/);
  return new Date(m ? `${m[1]}T${m[2]}${m[3]}:${m[4]}` : s).toISOString();
}

function toMeters(v: string | undefined, unit: string | undefined) {
  const n = Number(v);
  if (!v || !isFinite(n)) return null;
  if (unit === "km") return n * 1000;
  if (unit === "mi") return n * 1609.344;
  if (unit === "m") return n;
  return null;
}

/** Parsar GPX-text från Apple (trkpt med lat/lon, ele och time). */
export function parseGpx(text: string): TrackPoint[] {
  const pts: TrackPoint[] = [];
  const re = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g;
  let t0: number | null = null;
  for (const m of text.matchAll(re)) {
    const lat = Number(m[1].match(/lat="([^"]+)"/)?.[1]);
    const lng = Number(m[1].match(/lon="([^"]+)"/)?.[1]);
    const ele = m[2].match(/<ele>([^<]+)<\/ele>/)?.[1];
    const time = m[2].match(/<time>([^<]+)<\/time>/)?.[1];
    if (!isFinite(lat) || !isFinite(lng) || !time) continue;
    const ts = Date.parse(time) / 1000;
    t0 ??= ts;
    pts.push({ t: ts - t0, lat, lng, ele: ele !== undefined ? Number(ele) : undefined });
  }
  return pts;
}

export type Progress = { bytes: number; total: number; workouts: number };

/** Strömmar zip-filen och returnerar alla träningspass med rutter. */
export async function parseAppleHealthExport(
  stream: ReadableStream<Uint8Array>,
  total: number,
  onProgress: (p: Progress) => void = () => {},
): Promise<{ workouts: RawWorkout[]; gpx: Map<string, string> }> {
  const workouts: RawWorkout[] = [];
  const gpxChunks = new Map<string, Uint8Array[]>();
  let cur: RawWorkout | null = null;
  let failure: unknown = null;

  const parser = new SaxesParser();
  parser.on("opentag", (tag) => {
    const a = tag.attributes as Record<string, string>;
    if (tag.name === "Workout") cur = { attrs: a, stats: {}, meta: {}, routePath: null };
    else if (cur) {
      if (tag.name === "WorkoutStatistics") cur.stats[(a.type ?? "").replace("HKQuantityTypeIdentifier", "")] = a;
      else if (tag.name === "MetadataEntry") cur.meta[a.key] = a.value;
      else if (tag.name === "FileReference") cur.routePath = a.path;
    }
  });
  parser.on("closetag", (tag) => {
    if (tag.name === "Workout" && cur) {
      workouts.push(cur);
      cur = null;
    }
  });
  parser.on("error", (e) => (failure ??= e));

  const decoder = new TextDecoder();
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (f) => {
    if (/(^|\/)export\.xml$/.test(f.name)) {
      f.ondata = (err, chunk, final) => {
        if (err) return void (failure ??= err);
        try {
          parser.write(decoder.decode(chunk, { stream: !final }));
          if (final) parser.close();
        } catch (e) {
          failure ??= e;
        }
      };
      f.start();
    } else if (/workout-routes\/[^/]+\.gpx$/.test(f.name)) {
      const parts: Uint8Array[] = [];
      gpxChunks.set(f.name.slice(f.name.indexOf("/workout-routes/")), parts);
      f.ondata = (err, chunk) => {
        if (err) return void (failure ??= err);
        parts.push(chunk);
      };
      f.start();
    }
  };

  const reader = stream.getReader();
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (value) bytes += value.length;
    unzip.push(value ?? new Uint8Array(0), done);
    if (failure) throw failure;
    onProgress({ bytes, total, workouts: workouts.length });
    if (done) break;
  }

  const gpx = new Map<string, string>();
  for (const [name, parts] of gpxChunks) {
    const len = parts.reduce((s, p) => s + p.length, 0);
    const buf = new Uint8Array(len);
    let o = 0;
    for (const p of parts) {
      buf.set(p, o);
      o += p.length;
    }
    gpx.set(name, new TextDecoder().decode(buf));
  }
  return { workouts, gpx };
}

/** Gör om råa pass till rader för tabellen `activities`. */
export function toActivityRows(workouts: RawWorkout[], gpx: Map<string, string>): ActivityRow[] {
  return workouts.map((w) => {
    const rawType = (w.attrs.workoutActivityType ?? "").replace("HKWorkoutActivityType", "");
    const sport = TYPE_MAP[rawType] ?? rawType ?? "Other";
    const start = appleDate(w.attrs.startDate);
    const end = w.attrs.endDate ? appleDate(w.attrs.endDate) : null;
    const durNum = Number(w.attrs.duration);
    const duration = isFinite(durNum)
      ? Math.round(w.attrs.durationUnit === "s" ? durNum : w.attrs.durationUnit === "hr" ? durNum * 3600 : durNum * 60)
      : null;
    const distStat = w.stats.DistanceWalkingRunning ?? w.stats.DistanceCycling ?? w.stats.DistanceSwimming;
    const distance =
      toMeters(distStat?.sum, distStat?.unit) ?? toMeters(w.attrs.totalDistance, w.attrs.totalDistanceUnit);
    const hr = w.stats.HeartRate;
    const kcal = Number(w.stats.ActiveEnergyBurned?.sum ?? w.attrs.totalEnergyBurned);
    const elevMeta = w.meta.HKElevationAscended?.match(/^([\d.]+)\s*(cm|m)?/);
    let elevation = elevMeta ? Number(elevMeta[1]) / (elevMeta[2] === "cm" ? 100 : 1) : null;
    const indoor = w.meta.HKIndoorWorkout === "1";

    let splits: ActivityRow["splits"] = null;
    let route: ActivityRow["route"] = null;
    const text = w.routePath ? gpx.get(w.routePath) : undefined;
    if (text) {
      const track = withDistance(parseGpx(text));
      if (track.length > 1) {
        if (sport === "Run") splits = computeSplits(track);
        route = simplifyRoute(track);
        elevation ??= elevationGain(track);
      }
    }
    const isRunSport = sport === "Run";
    return {
      source: "apple_health",
      external_id: start,
      sport_type: sport,
      name: null,
      start_time: start,
      distance_m: distance !== null ? Math.round(distance * 10) / 10 : null,
      moving_time_s: duration,
      elapsed_time_s: end ? Math.round((Date.parse(end) - Date.parse(start)) / 1000) : duration,
      avg_hr: hr?.average ? Math.round(Number(hr.average)) : null,
      max_hr: hr?.maximum ? Math.round(Number(hr.maximum)) : null,
      elevation_gain_m: elevation !== null ? Math.round(elevation) : null,
      avg_pace_s_per_km: isRunSport && distance && duration ? Math.round((duration / distance) * 1000 * 10) / 10 : null,
      calories: isFinite(kcal) && kcal > 0 ? Math.round(kcal) : null,
      indoor,
      splits,
      route,
      details_fetched: true,
    };
  });
}
