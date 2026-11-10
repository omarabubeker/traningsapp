import { isoDay } from "./dates";
import { isRun } from "./running";
import type { DoneSession } from "./coach/plan";

type Act = { sport_type: string; start_time: string; distance_m?: number | null; distance_override_m?: number | null };

/** Gjorda pass (löpning, gym, övrigt) i förenklad form. Klockans styrkepass samma dag som ett loggat gympass räknas inte två gånger. */
export function doneSessions(activities: Act[], gymStarts: string[]): DoneSession[] {
  const gymDays = new Set(gymStarts.map((t) => isoDay(new Date(t))));
  const out: DoneSession[] = [...gymStarts.map((t) => ({ kind: "gym" as const, day: isoDay(new Date(t)) }))];
  for (const a of activities) {
    const day = isoDay(new Date(a.start_time));
    if (isRun(a.sport_type)) out.push({ kind: "run", day, km: (a.distance_override_m ?? a.distance_m ?? 0) / 1000 });
    else if (a.sport_type === "Strength") {
      if (!gymDays.has(day)) out.push({ kind: "gym", day });
    } else out.push({ kind: "other", day });
  }
  return out;
}
