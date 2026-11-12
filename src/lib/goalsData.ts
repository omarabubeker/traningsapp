import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDay } from "./dates";
import { applyOverride } from "./running";
import type { Goal } from "./goalDef";
import { loadDoneSessions, mondayOf, withStatus } from "./coach/planData";
import { addDaysIso } from "./coach/plan";
import { milestones, personalRecords, streak, weekRings, weekScore, type GymSetLike, type RunLike } from "./goals";
import type { Plan, PlanItem } from "./types";

/** Hämtar alla rader i omgångar (Supabase ger högst 1 000 rader per anrop). */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error || !data) break;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

type GymRow = { reps: number; weight_kg: number | string; is_warmup: boolean; exercises: { name: string; is_bodyweight: boolean } | null; gym_sessions: { started_at: string } | null };

/** Personens mål: aktivt huvudmål, delmål och avklarade mål (historik). */
export async function loadUserGoals(supabase: SupabaseClient) {
  const { data } = await supabase.from("goals").select("*").order("created_at");
  const all = ((data ?? []) as Goal[]).map((g) => ({
    ...g,
    distance_km: g.distance_km === null ? null : Number(g.distance_km),
  }));
  return {
    primary: all.find((g) => g.is_primary && g.status === "active") ?? null,
    sub: all.filter((g) => !g.is_primary && g.status === "active"),
    history: all.filter((g) => g.status === "completed").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
  };
}

/** All data för mål och spel: veckoringar, svit, rekord och milstolpar. */
export async function loadGoals(supabase: SupabaseClient) {
  const today = isoDay();
  const monday = mondayOf(today);
  const [{ data: planRows }, acts, sets, sessions, userGoals] = await Promise.all([
    supabase.from("plans").select("*, plan_items(*)").eq("status", "active").order("week_start"),
    fetchAll((a, b) =>
      supabase
        .from("activities")
        .select("id, sport_type, start_time, distance_m, distance_override_m, moving_time_s, avg_pace_s_per_km, indoor")
        .is("deleted_at", null)
        .ilike("sport_type", "%run%")
        .order("start_time")
        .range(a, b),
    ),
    fetchAll((a, b) =>
      supabase
        .from("gym_sets")
        .select("reps, weight_kg, is_warmup, exercises(name, is_bodyweight), gym_sessions(started_at)")
        .eq("is_warmup", false)
        .order("created_at")
        .range(a, b),
    ),
    loadDoneSessions(supabase, addDaysIso(monday, -26 * 7)),
    loadUserGoals(supabase),
  ]);
  const rows = ((planRows ?? []) as (Plan & { plan_items: PlanItem[] })[]).filter((p) => p.week_start >= addDaysIso(monday, -26 * 7));
  const plans = withStatus(rows, sessions, today);

  const current = plans.find((p) => p.week_start === monday) ?? null;
  const weeks = plans.map((p) => ({ weekStart: p.week_start, ...weekScore(p.items) }));

  const runs: RunLike[] = acts.map((a) => {
    const r = applyOverride(a as Parameters<typeof applyOverride>[0] & { id: string; start_time: string; indoor: boolean | null });
    return {
      id: r.id,
      day: isoDay(new Date(r.start_time)),
      km: (r.distance_m ?? 0) / 1000,
      pace: r.avg_pace_s_per_km ? Number(r.avg_pace_s_per_km) : null,
      reliable: !r.indoor || r.corrected,
    };
  });
  const gymSets: GymSetLike[] = (sets as unknown as GymRow[])
    .filter((s) => s.exercises && s.gym_sessions)
    .map((s) => ({
      exercise: s.exercises!.name,
      bodyweight: s.exercises!.is_bodyweight,
      day: isoDay(new Date(s.gym_sessions!.started_at)),
      weight: Number(s.weight_kg),
      reps: s.reps,
      warmup: s.is_warmup,
    }));

  return {
    today,
    rings: current ? weekRings(current.items, sessions, monday) : null,
    weekKm: Math.round(sessions.filter((s) => s.kind === "run" && s.day >= monday).reduce((t, s) => t + (s.km ?? 0), 0) * 10) / 10,
    streak: streak(weeks, monday),
    weeks,
    records: personalRecords(runs, gymSets, today),
    goal: userGoals.primary,
    subGoals: userGoals.sub,
    history: userGoals.history,
    milestones: userGoals.primary
      ? milestones(runs, userGoals.primary, [...new Set(sessions.map((x) => x.day))], {
          days: sessions.filter((x) => x.kind === "gym").map((x) => x.day),
          sets: gymSets,
        })
      : [],
  };
}

export type Goals = Awaited<ReturnType<typeof loadGoals>>;
