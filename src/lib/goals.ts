// Spelifiering: veckoringar, veckosvit, personliga rekord och vägen till maran.
// Rena funktioner (testas i goals.test.ts); all data hämtas i goalsData.ts.
import type { DoneSession, ItemResult } from "./coach/plan";
import { addDaysIso } from "./coach/plan";
import { e1rm } from "./gym";
import { formatPace } from "./running";
import { HALF_PACE, MARATHON_PACE } from "./race";
import type { PlanItem } from "./types";

export const STREAK_SHARE = 0.8;

export function streakText(current: number) {
  return current === 0 ? "Gör minst 80 % av veckans plan för att starta en svit" : `${current} ${current === 1 ? "vecka" : "veckor"} i rad med minst 80 % av planen`;
} // andel av planen som krävs för att veckan ska räknas

export function mondayOfIso(day: string) {
  const d = new Date(day + "T00:00:00Z");
  return addDaysIso(day, -((d.getUTCDay() + 6) % 7));
}

const sv1 = (n: number) => n.toLocaleString("sv-SE", { maximumFractionDigits: 1 });

// --- Veckan ------------------------------------------------------------------------

export type Ring = { done: number; target: number };
export type WeekRings = { km: Ring; gym: Ring; plan: { done: number; total: number } };

type Item = Pick<PlanItem, "kind" | "target"> & Pick<ItemResult, "status">;

/** Planens poäng för en vecka: genomförda pass av planerade (vila räknas inte). */
export function weekScore(items: Item[]) {
  const work = items.filter((i) => i.kind !== "rest");
  return { done: work.filter((i) => i.status === "done").length, total: work.length };
}

/** Tre ringar för veckan: löp-km mot planerade km, gympass mot planerade, och planen totalt. */
export function weekRings(items: Item[], sessions: DoneSession[], weekStart: string): WeekRings {
  const weekEnd = addDaysIso(weekStart, 6);
  const inWeek = sessions.filter((s) => s.day >= weekStart && s.day <= weekEnd);
  const plannedKm = items
    .filter((i) => i.kind === "run")
    .reduce((s, i) => s + (Number((i.target as { distance_km?: number } | null)?.distance_km) || 0), 0);
  return {
    km: { done: Math.round(inWeek.filter((s) => s.kind === "run").reduce((t, s) => t + (s.km ?? 0), 0) * 10) / 10, target: Math.round(plannedKm * 10) / 10 },
    gym: { done: inWeek.filter((s) => s.kind === "gym").length, target: items.filter((i) => i.kind === "gym").length },
    plan: weekScore(items),
  };
}

export type WeekResult = { weekStart: string; done: number; total: number };

/**
 * Veckosvit: veckor i rad där minst 80 % av planen blev gjord. Veckor utan plan hoppas över
 * (bryter inte sviten). Innevarande vecka räknas om den redan är klar, annars bryter den inte heller.
 */
export function streak(weeks: WeekResult[], currentWeekStart: string) {
  const ok = (w: WeekResult) => w.total > 0 && w.done / w.total >= STREAK_SHARE;
  const sorted = [...weeks].filter((w) => w.total > 0).sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  let current = 0;
  for (const w of sorted) {
    if (w.weekStart > currentWeekStart) continue;
    if (w.weekStart === currentWeekStart && !ok(w)) continue;
    if (!ok(w)) break;
    current++;
  }
  let best = 0;
  let run = 0;
  for (const w of [...sorted].reverse()) {
    if (w.weekStart > currentWeekStart || (w.weekStart === currentWeekStart && !ok(w))) continue;
    run = ok(w) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current, best };
}

// --- Rekord ------------------------------------------------------------------------

export type RunLike = { id: string; day: string; km: number; pace: number | null; reliable: boolean };
export type GymSetLike = { exercise: string; day: string; weight: number; reps: number; warmup: boolean; bodyweight: boolean };

export type RecordItem = {
  key: string;
  group: "run" | "gym";
  label: string;
  value: string;
  day: string;
  previous: string | null;
  href?: string;
  isNew: boolean;
};

const NEW_DAYS = 7;

function best<T>(xs: T[], score: (x: T) => number) {
  return xs.reduce<T | null>((b, x) => (!b || score(x) > score(b) ? x : b), null);
}

/** Personliga rekord ur all data. "Nytt" = slog ett tidigare rekord de senaste 7 dagarna. */
export function personalRecords(runs: RunLike[], sets: GymSetLike[], today: string): RecordItem[] {
  const out: RecordItem[] = [];
  const fresh = (day: string) => day >= addDaysIso(today, -(NEW_DAYS - 1));
  const add = <T extends { day: string }>(key: string, group: "run" | "gym", label: string, xs: T[], score: (x: T) => number, fmt: (x: T) => string, href?: (x: T) => string) => {
    const sorted = [...xs].sort((x, y) => x.day.localeCompare(y.day)); // vid lika värde gäller första gången
    const b = best(sorted, score);
    if (!b) return;
    const prev = best(sorted.filter((x) => x.day < b.day), score);
    out.push({ key, group, label, value: fmt(b), day: b.day, previous: prev ? fmt(prev) : null, href: href?.(b), isNew: fresh(b.day) && !!prev });
  };
  const link = (r: RunLike) => `/lopning/${r.id}`;
  add("longest", "run", "Längsta pass", runs, (r) => r.km, (r) => `${sv1(r.km)} km`, link);
  const paced = runs.filter((r) => r.reliable && r.pace);
  for (const [min, label] of [[5, "Snabbaste pass 5 km+"], [10, "Snabbaste pass 10 km+"], [21.1, "Snabbaste halvmara+"]] as const) {
    add(`pace${min}`, "run", label, paced.filter((r) => r.km >= min), (r) => -(r.pace ?? 0), (r) => `${formatPace(r.pace)}/km`, link);
  }
  const weekKm = new Map<string, number>();
  for (const r of runs) weekKm.set(mondayOfIso(r.day), (weekKm.get(mondayOfIso(r.day)) ?? 0) + r.km);
  add("week", "run", "Flest km på en vecka", [...weekKm].map(([day, km]) => ({ day, km })), (w) => w.km, (w) => `${sv1(w.km)} km`);

  const byEx = new Map<string, GymSetLike[]>();
  for (const s of sets) if (!s.warmup && s.reps > 0) byEx.set(s.exercise, [...(byEx.get(s.exercise) ?? []), s]);
  for (const [name, xs] of [...byEx].sort((a, b) => a[0].localeCompare(b[0], "sv"))) {
    const weighted = xs.some((x) => x.weight > 0);
    if (weighted) add(`e1rm:${name}`, "gym", name, xs.filter((x) => x.weight > 0), (x) => e1rm(x.weight, x.reps), (x) => `${sv1(x.weight)} kg × ${x.reps}`);
    else add(`reps:${name}`, "gym", name, xs, (x) => x.reps, (x) => `${x.reps} reps`);
  }
  return out;
}

// --- Vägen till maran ----------------------------------------------------------------

export type Milestone = { key: string; label: string; detail: string; day: string | null };

/** Milstolpar mot maran, i ungefärlig svårighetsordning. day = när den nåddes först. */
export function milestones(runs: RunLike[], since: string): Milestone[] {
  const rs = runs.filter((r) => r.day >= since).sort((a, b) => a.day.localeCompare(b.day));
  const first = (f: (r: RunLike) => boolean) => rs.find(f)?.day ?? null;
  const weeks = new Map<string, number>();
  for (const r of rs) weeks.set(mondayOfIso(r.day), (weeks.get(mondayOfIso(r.day)) ?? 0) + r.km);
  const weekList = [...weeks].sort((a, b) => a[0].localeCompare(b[0]));
  const firstWeek = (km: number) => {
    const w = weekList.find(([, k]) => k >= km);
    return w ? addDaysIso(w[0], 6) : null;
  };
  const threeInRow = () => {
    for (let i = 2; i < weekList.length; i++) {
      const [a, b, c] = [weekList[i - 2], weekList[i - 1], weekList[i]];
      const consecutive = addDaysIso(a[0], 7) === b[0] && addDaysIso(b[0], 7) === c[0];
      if (consecutive && a[1] >= 40 && b[1] >= 40 && c[1] >= 40) return addDaysIso(c[0], 6);
    }
    return null;
  };
  const fast = (km: number, pace: number) => (r: RunLike) => r.km >= km && r.reliable && !!r.pace && r.pace <= pace;
  return [
    { key: "long15", label: "Långpass 15 km", detail: "Första passet på minst 15 km", day: first((r) => r.km >= 15) },
    { key: "week40", label: "Vecka med 40 km", detail: "Minst 40 km löpning på en vecka", day: firstWeek(40) },
    { key: "long20", label: "Långpass 20 km", detail: "Första passet på minst 20 km", day: first((r) => r.km >= 20) },
    { key: "half", label: "Halvmara under 1:55", detail: `21,1 km i ${formatPace(HALF_PACE)}/km eller snabbare`, day: first(fast(21.1, HALF_PACE)) },
    { key: "long25", label: "Långpass 25 km", detail: "Första passet på minst 25 km", day: first((r) => r.km >= 25) },
    { key: "week50", label: "Vecka med 50 km", detail: "Minst 50 km löpning på en vecka", day: firstWeek(50) },
    { key: "three40", label: "Tre veckor i rad med 40 km", detail: "Tre veckor efter varandra med minst 40 km", day: threeInRow() },
    { key: "long30", label: "Långpass 30 km", detail: "Första passet på minst 30 km", day: first((r) => r.km >= 30) },
    { key: "mp30", label: "30 km i maratonfart", detail: `30 km i ${formatPace(MARATHON_PACE)}/km eller snabbare`, day: first(fast(30, MARATHON_PACE)) },
    { key: "long32", label: "Långpass 32 km", detail: "Det längsta passet före maran", day: first((r) => r.km >= 32) },
  ];
}
