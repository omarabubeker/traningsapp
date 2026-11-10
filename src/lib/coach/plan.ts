import type { PlanItem } from "../types";

export type ItemStatus = "done" | "missed" | "today" | "upcoming" | "rest" | "pending";

/** Ett genomfört pass, förenklat för matchning mot planen. */
export type DoneSession = { kind: "run" | "gym" | "other"; day: string; km?: number | null };

export type ItemResult = { status: ItemStatus; doneDay?: string };

const DAY = 864e5;
export const addDaysIso = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const dayDiff = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY;
const targetKm = (it: Pick<PlanItem, "target">) => Number((it.target as { distance_km?: number } | null)?.distance_km) || null;

/**
 * Matchar en veckas planerade pass mot det som faktiskt gjorts under veckan.
 * Dagen spelar ingen roll: ett pass räknas som gjort om ett pass av samma typ blev av
 * någon gång under veckan (först samma dag, sedan närmaste lediga pass; löppass paras
 * helst ihop efter distans så att långpasset matchas mot det längsta passet).
 * Ett pass vars dag har passerat räknas som missat först när veckan är slut.
 */
export function matchWeek(
  items: Pick<PlanItem, "id" | "date" | "kind" | "target">[],
  sessions: DoneSession[],
  weekStart: string,
  today: string,
): Map<string, ItemResult> {
  const weekEnd = addDaysIso(weekStart, 6);
  const pool = sessions.filter((s) => s.day >= weekStart && s.day <= weekEnd).map((s) => ({ ...s, used: false }));
  const res = new Map<string, ItemResult>();
  const fits = (kind: PlanItem["kind"], s: DoneSession) => kind === "other" || s.kind === kind;
  const take = (it: (typeof items)[number], s: (typeof pool)[number]) => {
    s.used = true;
    res.set(it.id, { status: "done", doneDay: s.day });
  };
  const work = items.filter((i) => i.kind !== "rest");
  for (const group of [work.filter((i) => i.kind !== "other"), work.filter((i) => i.kind === "other")]) {
    // 1. Samma dag
    for (const it of group) {
      const s = pool.find((x) => !x.used && x.day === it.date && fits(it.kind, x));
      if (s) take(it, s);
    }
    // 2. Annan dag samma vecka (längsta planerade löppass först)
    const rest = group.filter((i) => !res.has(i.id)).sort((a, b) => (targetKm(b) ?? 0) - (targetKm(a) ?? 0) || a.date.localeCompare(b.date));
    for (const it of rest) {
      const km = targetKm(it);
      const cands = pool.filter((x) => !x.used && fits(it.kind, x));
      if (!cands.length) continue;
      const cost = (x: (typeof pool)[number]) => (km != null && x.km != null ? Math.abs(x.km - km) * 10 : 0) + dayDiff(x.day, it.date);
      take(it, cands.reduce((b, x) => (cost(x) < cost(b) ? x : b)));
    }
  }
  for (const it of items) {
    if (res.has(it.id)) continue;
    const status: ItemStatus =
      it.kind === "rest" ? "rest" : it.date === today ? "today" : it.date > today ? "upcoming" : weekEnd >= today ? "pending" : "missed";
    res.set(it.id, { status });
  }
  return res;
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  done: "Klart",
  missed: "Missat",
  today: "Idag",
  upcoming: "",
  rest: "Vila",
  pending: "Kvar i veckan",
};
