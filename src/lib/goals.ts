// Spelifiering: veckoringar, veckosvit, personliga rekord och vägen mot målet.
// Rena funktioner (testas i goals.test.ts); all data hämtas i goalsData.ts.
import type { DoneSession, ItemResult } from "./coach/plan";
import { addDaysIso } from "./coach/plan";
import { e1rm } from "./gym";
import { formatPace } from "./running";
import { formatTime, riegel, type Goal } from "./goalDef";
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

// --- Vägen mot målet ------------------------------------------------------------------

export type Milestone = { key: string; label: string; detail: string; day: string | null; badge: string };

type GoalLike = Pick<Goal, "kind" | "distance_km" | "target_time_s" | "start_date">;

const kmText = (km: number) => km.toLocaleString("sv-SE", { maximumFractionDigits: 1 });
/** "1:55" för tider över en timme (avrundat nedåt till hel minut), annars "24:30". */
const shortTime = (sec: number) => (sec >= 3600 ? `${Math.floor(sec / 3600)}:${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}` : formatTime(Math.floor(sec)));

/**
 * Milstolpar mot huvudmålet, i ungefärlig svårighetsordning. day = när den nåddes först.
 * Lopp: långpass, veckovolym, ett testlopp (Riegel från måltiden) och ett pass i måltempo,
 * skalat efter distansen. Allmänt mål: antal pass och kilometer sedan start.
 */
export function milestones(runs: RunLike[], goal: GoalLike, workoutDays: string[] = []): Milestone[] {
  const since = goal.start_date;
  const rs = runs.filter((r) => r.day >= since).sort((a, b) => a.day.localeCompare(b.day));
  const first = (f: (r: RunLike) => boolean) => rs.find(f)?.day ?? null;

  if (goal.kind !== "race" || !goal.distance_km) {
    const days = [...workoutDays].filter((d) => d >= since).sort();
    const nth = (n: number) => days[n - 1] ?? null;
    let total = 0;
    const kmDay = (km: number) => rs.find((r) => (total += r.km) >= km)?.day ?? null;
    const km100 = kmDay(100);
    total = 0;
    const km250 = kmDay(250);
    return [
      { key: "pass10", label: "10 pass", detail: "Tio träningspass sedan start", day: nth(10), badge: "10" },
      { key: "pass25", label: "25 pass", detail: "25 träningspass sedan start", day: nth(25), badge: "25" },
      { key: "km100", label: "100 km löpning", detail: "Sammanlagt sedan start", day: km100, badge: "100" },
      { key: "pass50", label: "50 pass", detail: "50 träningspass sedan start", day: nth(50), badge: "50" },
      { key: "km250", label: "250 km löpning", detail: "Sammanlagt sedan start", day: km250, badge: "250" },
      { key: "pass100", label: "100 pass", detail: "100 träningspass sedan start", day: nth(100), badge: "100" },
    ];
  }

  const D = goal.distance_km;
  const marathon = D >= 40;
  const ladder = marathon ? [15, 20, 25, 30, 32] : D >= 20 ? [10, 12, 15, 18, 21] : D >= 10 ? [5, 8, 10, 12, 14] : [3, 5, 6, 8, 10];
  const [w1, w2] = marathon ? [40, 50] : D >= 20 ? [25, 35] : D >= 10 ? [20, 30] : [15, 25];
  const test = marathon ? { km: 21.0975, name: "Halvmara", badge: "½", key: "half" } : D >= 20 ? { km: 10, name: "10 km", badge: "10K", key: "test" } : D >= 10 ? { km: 5, name: "5 km", badge: "5K", key: "test" } : { km: 3, name: "3 km", badge: "3K", key: "test" };
  const gpKm = marathon ? 30 : D >= 20 ? 15 : D >= 10 ? 8 : 4;

  const weeks = new Map<string, number>();
  for (const r of rs) weeks.set(mondayOfIso(r.day), (weeks.get(mondayOfIso(r.day)) ?? 0) + r.km);
  const weekList = [...weeks].sort((a, b) => a[0].localeCompare(b[0]));
  const firstWeek = (km: number) => {
    const w = weekList.find(([, k]) => k >= km);
    return w ? addDaysIso(w[0], 6) : null;
  };
  const threeInRow = (km: number) => {
    for (let i = 2; i < weekList.length; i++) {
      const [a, b, c] = [weekList[i - 2], weekList[i - 1], weekList[i]];
      const consecutive = addDaysIso(a[0], 7) === b[0] && addDaysIso(b[0], 7) === c[0];
      if (consecutive && a[1] >= km && b[1] >= km && c[1] >= km) return addDaysIso(c[0], 6);
    }
    return null;
  };
  const fast = (km: number, pace: number) => (r: RunLike) => r.km >= km - 0.05 && r.reliable && !!r.pace && r.pace <= pace;
  const long = (km: number, last = false) => ({
    key: `long${km}`,
    label: `Långpass ${kmText(km)} km`,
    detail: last ? "Det längsta passet före loppet" : `Första passet på minst ${kmText(km)} km`,
    day: first((r) => r.km >= km - 0.05),
    badge: kmText(km),
  });
  const week = (km: number) => ({ key: `week${km}`, label: `Vecka med ${km} km`, detail: `Minst ${km} km löpning på en vecka`, day: firstWeek(km), badge: String(km) });

  const out: Milestone[] = [long(ladder[0]), week(w1), long(ladder[1])];
  const target = goal.target_time_s;
  if (target) {
    const t = riegel(target, D, test.km);
    out.push({ key: test.key, label: `${test.name} under ${shortTime(t)}`, detail: `${kmText(test.km)} km i ${formatPace(t / test.km)}/km eller snabbare`, day: first(fast(test.km, t / test.km)), badge: test.badge });
  }
  out.push(long(ladder[2]), week(w2), { key: `three${w1}`, label: `Tre veckor i rad med ${w1} km`, detail: `Tre veckor efter varandra med minst ${w1} km`, day: threeInRow(w1), badge: "3×" }, long(ladder[3]));
  if (target) {
    const pace = target / D;
    out.push({ key: marathon ? `mp${gpKm}` : `gp${gpKm}`, label: `${gpKm} km i ${marathon ? "maratonfart" : "måltempo"}`, detail: `${gpKm} km i ${formatPace(pace)}/km eller snabbare`, day: first(fast(gpKm, pace)), badge: marathon ? "MP" : "MT" });
  }
  out.push(long(ladder[4], true));
  return out;
}
