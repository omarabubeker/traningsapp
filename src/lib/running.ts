// Gemensamma beräkningar för löppass: splits, rutt, tempo. Inga beroenden.

export type TrackPoint = {
  t: number; // sekunder från start
  d?: number; // meter från start (räknas fram från lat/lng om den saknas)
  lat?: number;
  lng?: number;
  ele?: number;
  hr?: number;
};

export type Split = { km: number; dist_m: number; time_s: number; pace_s: number; hr: number | null; elev_m: number | null };

const R = 6371000;
export function haversine(a: [number, number], b: [number, number]) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Fyller i kumulativ distans från koordinater där den saknas. */
export function withDistance(points: TrackPoint[]): TrackPoint[] {
  if (points.every((p) => p.d !== undefined)) return points;
  let d = 0;
  return points.map((p, i) => {
    const prev = points[i - 1];
    if (i > 0 && prev.lat !== undefined && p.lat !== undefined) {
      d += haversine([prev.lat, prev.lng!], [p.lat, p.lng!]);
    }
    return { ...p, d };
  });
}

/** Splits per km (sista ofullständiga km tas med om den är minst 100 m). */
export function computeSplits(raw: TrackPoint[]): Split[] {
  const pts = withDistance(raw).filter((p) => p.d !== undefined);
  if (pts.length < 2) return [];
  const splits: Split[] = [];
  let startIdx = 0;
  let startT = pts[0].t;
  let startD = pts[0].d!;
  let km = 1;

  const interpT = (i: number, target: number) => {
    const a = pts[i - 1], b = pts[i];
    const span = b.d! - a.d!;
    return span > 0 ? a.t + ((target - a.d!) / span) * (b.t - a.t) : b.t;
  };
  const summarize = (from: number, to: number, endT: number, dist: number) => {
    const seg = pts.slice(from, to + 1);
    const hrs = seg.map((p) => p.hr).filter((x): x is number => !!x);
    let up = 0;
    for (let i = 1; i < seg.length; i++) {
      const de = (seg[i].ele ?? 0) - (seg[i - 1].ele ?? 0);
      if (seg[i].ele !== undefined && seg[i - 1].ele !== undefined && de > 0) up += de;
    }
    const time = endT - startT;
    splits.push({
      km,
      dist_m: Math.round(dist),
      time_s: Math.round(time),
      pace_s: Math.round(time / (dist / 1000)),
      hr: hrs.length ? Math.round(hrs.reduce((s, x) => s + x, 0) / hrs.length) : null,
      elev_m: seg.some((p) => p.ele !== undefined) ? Math.round(up) : null,
    });
  };

  for (let i = 1; i < pts.length; i++) {
    while (pts[i].d! - startD >= 1000) {
      const target = startD + 1000;
      const endT = interpT(i, target);
      summarize(startIdx, i, endT, 1000);
      startIdx = i;
      startT = endT;
      startD = target;
      km++;
    }
  }
  const last = pts[pts.length - 1];
  const rest = last.d! - startD;
  if (rest >= 100) summarize(startIdx, pts.length - 1, last.t, rest);
  return splits;
}

/** Förenklar rutten till högst `max` punkter (jämnt urval, start och mål behålls). */
export function simplifyRoute(points: TrackPoint[], max = 400): [number, number][] {
  const ll = points.filter((p) => p.lat !== undefined && p.lng !== undefined).map((p) => [p.lat!, p.lng!] as [number, number]);
  if (ll.length <= max) return ll.map(round);
  const step = (ll.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => round(ll[Math.round(i * step)]));
  function round(p: [number, number]): [number, number] {
    return [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];
  }
}

export function elevationGain(points: TrackPoint[]) {
  let up = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].ele, b = points[i].ele;
    if (a !== undefined && b !== undefined && b > a) up += b - a;
  }
  return Math.round(up);
}

export function formatPace(secPerKm: number | null | undefined) {
  if (!secPerKm || !isFinite(secPerKm)) return "–";
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatDuration(sec: number | null | undefined) {
  if (!sec) return "–";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export function formatKm(m: number | null | undefined) {
  if (!m) return "–";
  return (m / 1000).toLocaleString("sv-SE", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export const SPORT_LABEL: Record<string, string> = {
  Run: "Löpning",
  TrailRun: "Terränglöpning",
  VirtualRun: "Löpband",
  Walk: "Promenad",
  Hike: "Vandring",
  Ride: "Cykel",
  VirtualRide: "Inomhuscykel",
  Strength: "Styrka (klocka)",
  Kickboxing: "Kickboxning",
  CrossTraining: "Crossträning",
  WeightTraining: "Styrka (klocka)",
  HIIT: "HIIT",
  Swim: "Simning",
};

export const isRun = (sport: string) => /run/i.test(sport);
