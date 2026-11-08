import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDay } from "../dates";
import { isRun } from "../running";
import type { Plan, PlanItem } from "../types";
import { itemStatus, type ItemStatus } from "./plan";

const DAY = 864e5;

export type PlanWithItems = Plan & { items: (PlanItem & { status: ItemStatus })[] };

/** Aktiva planer för innevarande och kommande vecka, med status mot genomförda pass. */
export async function loadPlans(supabase: SupabaseClient): Promise<{ today: string; plans: PlanWithItems[] }> {
  const today = isoDay();
  const d = new Date(today + "T00:00:00Z");
  const monday = new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
  const [{ data: plans }, { data: acts }, { data: gyms }] = await Promise.all([
    supabase.from("plans").select("*, plan_items(*)").eq("status", "active").gte("week_start", monday).order("week_start"),
    supabase.from("activities").select("sport_type, start_time").is("deleted_at", null).gte("start_time", new Date(Date.parse(monday) - DAY).toISOString()),
    supabase.from("gym_sessions").select("started_at").gte("started_at", new Date(Date.parse(monday) - DAY).toISOString()),
  ]);
  const a = (acts ?? []).map((x) => ({ sport: x.sport_type as string, day: isoDay(new Date(x.start_time)) }));
  const g = (gyms ?? []).map((x) => isoDay(new Date(x.started_at)));
  const doneDays = {
    run: new Set(a.filter((x) => isRun(x.sport)).map((x) => x.day)),
    gym: new Set([...g, ...a.filter((x) => x.sport === "Strength").map((x) => x.day)]),
    any: new Set([...a.map((x) => x.day), ...g]),
  };
  type Row = Plan & { plan_items: PlanItem[] };
  return {
    today,
    plans: ((plans ?? []) as Row[]).map(({ plan_items, ...p }) => ({
      ...p,
      items: [...plan_items]
        .sort((x, y) => x.date.localeCompare(y.date) || x.sort - y.sort)
        .map((it) => ({ ...it, status: itemStatus(it, today, doneDays) })),
    })),
  };
}
