// Loppprognos och form – rena beräkningar (testbara, ingen databas).
import { riegel } from "./goalDef";

const DAY = 864e5;
const dayMs = (d: string) => Date.parse(d + "T12:00:00Z");
export const addDays = (d: string, n: number) => new Date(dayMs(d) + n * DAY).toISOString().slice(0, 10);

// ── Prognos ────────────────────────────────────────────────────────────────

type Split = { km: number; dist_m: number; time_s: number };
export type RunInput = { day: string; km: number; timeS: number; splits?: Split[] | null };
export type Effort = { day: string; km: number; timeS: number; label: string };

/** Snabbaste sammanhängande sträcka om `km` hela kilometer i ett pass (sekunder). */
export function bestSegment(splits: Split[] | null | undefined, km: number): number | null {
  const full = (splits ?? []).filter((s) => s.dist_m >= 990 && s.time_s > 0);
  if (full.length < km) return null;
  let best = Infinity;
  for (let i = 0; i + km <= full.length; i++) {
    let t = 0;
    for (let j = i; j < i + km; j++) t += full[j].time_s;
    best = Math.min(best, t);
  }
  return best;
}

/** Prestationer ur ett pass: hela passet samt snabbaste 5 och 10 km inom passet. */
export function effortsOf(run: RunInput): Effort[] {
  const out: Effort[] = [];
  if (run.km >= 3 && run.timeS > 0) out.push({ day: run.day, km: run.km, timeS: run.timeS, label: "pass" });
  for (const k of [5, 10]) {
    if (run.km < k + 0.5) continue;
    const t = bestSegment(run.splits, k);
    if (t) out.push({ day: run.day, km: k, timeS: t, label: `${k} km i passet` });
  }
  // Orimligt snabbt (fel i GPS eller distans): snabbare än 2:30/km räknas inte.
  return out.filter((e) => e.timeS / e.km >= 150);
}

/**
 * Prognos för en distans: bästa omräknade tid (Riegel) bland prestationerna de senaste
 * `windowDays` dagarna fram till `asOf`. Lugna pass ger en försiktig prognos.
 */
export function predict(efforts: Effort[], targetKm: number, asOf: string, windowDays = 56) {
  const from = addDays(asOf, -windowDays);
  let best: { timeS: number; from: Effort } | null = null;
  for (const e of efforts) {
    if (e.day <= from || e.day > asOf) continue;
    const t = riegel(e.timeS, e.km, targetKm);
    if (!best || t < best.timeS) best = { timeS: t, from: e };
  }
  return best;
}

/** Prognosen vecka för vecka (söndagar) de senaste `weeks` veckorna. */
export function predictionTrend(efforts: Effort[], targetKm: number, today: string, weeks = 12) {
  const sunday = addDays(today, (7 - new Date(dayMs(today)).getUTCDay()) % 7);
  const out: { day: string; timeS: number }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = w === 0 ? today : addDays(sunday, -7 * w);
    const p = predict(efforts, targetKm, end);
    if (p) out.push({ day: end, timeS: p.timeS });
  }
  return out;
}

// ── Form (belastning) ──────────────────────────────────────────────────────

export type LoadInput = { day: string; minutes: number; avgHr: number | null; load: number | null };
export type HrProfile = { rest: number; max: number };

/**
 * Belastning för ett pass. Intervals egen siffra om den finns, annars pulsbaserad
 * (Banister-TRIMP, skalad så att en timme nära tröskelpuls ≈ 100, som intervals).
 * Utan puls antas en måttlig ansträngning.
 */
export function sessionLoad(s: LoadInput, hr: HrProfile) {
  if (s.load != null && s.load > 0) return s.load;
  const r = s.avgHr ? Math.min(1, Math.max(0, (s.avgHr - hr.rest) / (hr.max - hr.rest))) : 0.55;
  return s.minutes * r * 0.64 * Math.exp(1.92 * r) * 0.6;
}

export type FormPoint = { day: string; fitness: number; fatigue: number; form: number };

/** Kondition (42 dagar) och trötthet (7 dagar) som glidande medel – form = kondition − trötthet. */
export function formSeries(sessions: LoadInput[], hr: HrProfile, from: string, today: string): FormPoint[] {
  const perDay = new Map<string, number>();
  for (const s of sessions) perDay.set(s.day, (perDay.get(s.day) ?? 0) + sessionLoad(s, hr));
  const out: FormPoint[] = [];
  let ctl = 0;
  let atl = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    // Formen för en dag gäller inför dagens pass (gårdagens värden).
    out.push({ day: d, fitness: ctl, fatigue: atl, form: ctl - atl });
    const l = perDay.get(d) ?? 0;
    ctl += (l - ctl) / 42;
    atl += (l - atl) / 7;
  }
  return out;
}

export type FormState = { key: "fresh" | "balance" | "building" | "high"; label: string; text: string };

/** Tolkning av formen (samma gränser som intervals.icu ungefär). */
export function formState(form: number): FormState {
  if (form > 5) return { key: "fresh", label: "Utvilad", text: "Du är pigg – bra läge för ett hårt pass eller ett lopp." };
  if (form >= -10) return { key: "balance", label: "I balans", text: "Lagom belastning – du håller formen." };
  if (form >= -30) return { key: "building", label: "Bygger form", text: "Du tränar hårt och bygger kondition. Sov och ät ordentligt." };
  return { key: "high", label: "Hög belastning", text: "Mycket på kort tid – lägg in vila så att kroppen hinner återhämta sig." };
}
