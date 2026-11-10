import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDay } from "../dates";
import { doneSessions } from "../sessions";
import type { Plan, PlanItem } from "../types";
import { matchWeek, type DoneSession, type ItemResult } from "./plan";

const DAY = 864e5;

export type PlanItemWithStatus = PlanItem & ItemResult;
export type PlanWithItems = Plan & { items: PlanItemWithStatus[] };

/** Måndag (YYYY-MM-DD) i veckan för en dag. */
export function mondayOf(dayIso: string) {
  const d = new Date(dayIso + "T00:00:00Z");
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10);
}

/** Gjorda pass från och med en dag (svensk tid), förenklade för matchning mot planen. */
export async function loadDoneSessions(supabase: SupabaseClient, fromDay: string): Promise<DoneSession[]> {
  const since = new Date(Date.parse(fromDay) - DAY).toISOString();
  const [{ data: acts }, { data: gyms }] = await Promise.all([
    supabase.from("activities").select("sport_type, start_time, distance_m, distance_override_m").is("deleted_at", null).gte("start_time", since),
    supabase.from("gym_sessions").select("started_at").gte("started_at", since),
  ]);
  return doneSessions(acts ?? [], (gyms ?? []).map((g) => g.started_at)).filter((s) => s.day >= fromDay);
}

type Row = Plan & { plan_items: PlanItem[] };

export function withStatus(rows: Row[], sessions: DoneSession[], today: string): PlanWithItems[] {
  return rows.map(({ plan_items, ...p }) => {
    const match = matchWeek(plan_items, sessions, p.week_start, today);
    return {
      ...p,
      items: [...plan_items].sort((x, y) => x.date.localeCompare(y.date) || x.sort - y.sort).map((it) => ({ ...it, ...match.get(it.id)! })),
    };
  });
}

/** Aktiva planer för innevarande och kommande vecka, med status mot genomförda pass (per vecka). */
export async function loadPlans(supabase: SupabaseClient): Promise<{ today: string; plans: PlanWithItems[]; sessions: DoneSession[] }> {
  const today = isoDay();
  const monday = mondayOf(today);
  const [{ data: plans }, sessions] = await Promise.all([
    supabase.from("plans").select("*, plan_items(*)").eq("status", "active").gte("week_start", monday).order("week_start"),
    loadDoneSessions(supabase, monday),
  ]);
  return { today, plans: withStatus((plans ?? []) as Row[], sessions, today), sessions };
}
