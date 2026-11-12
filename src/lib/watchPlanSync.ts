import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createWorkoutEvent, deleteWorkoutEvent, IntervalsError, updateWorkoutEvent, type IntervalsCreds } from "./intervals";
import { loadDoneSessions, mondayOf, withStatus } from "./coach/planData";
import { addDaysIso } from "./coach/plan";
import { plannedWorkout, workoutHash } from "./watchWorkout";
import { isoDay } from "./dates";
import type { Plan, PlanItem } from "./types";

type Row = PlanItem & { watch_event_id: string | null; watch_hash: string | null };

/**
 * Håller intervals-kalendern i takt med planen:
 * - kommande löppass skickas (bara nya eller ändrade),
 * - flyttade pass flyttas, pass i ersatta planer tas bort,
 * - missade pass från avslutade veckor städas bort så att klockan inte fylls med gamla pass.
 * Gjorda pass ligger kvar (intervals parar ihop dem med passet från klockan).
 */
export async function syncPlanToWatch(supabase: SupabaseClient, creds: IntervalsCreds) {
  const today = isoDay();
  const from = addDaysIso(mondayOf(today), -7);
  const [{ data: active }, { data: archived }, sessions] = await Promise.all([
    supabase.from("plans").select("*, plan_items(*)").eq("status", "active").gte("week_start", from),
    supabase.from("plans").select("id").eq("status", "archived").gte("week_start", from),
    loadDoneSessions(supabase, from),
  ]);
  const archivedIds = (archived ?? []).map((p) => p.id as string);
  const { data: stale } = archivedIds.length
    ? await supabase.from("plan_items").select("id, watch_event_id").in("plan_id", archivedIds).not("watch_event_id", "is", null)
    : { data: [] };
  const plans = withStatus((active ?? []) as (Plan & { plan_items: Row[] })[], sessions, today);
  let sent = 0;
  let removed = 0;

  const clear = async (id: string, eventId: string) => {
    await deleteWorkoutEvent(creds, eventId);
    await supabase.from("plan_items").update({ watch_event_id: null, watch_hash: null }).eq("id", id);
    removed++;
  };

  // Pass i planer som ersatts av en ny plan.
  for (const r of (stale ?? []) as { id: string; watch_event_id: string | null }[]) if (r.watch_event_id) await clear(r.id, r.watch_event_id);

  for (const item of plans.flatMap((p) => p.items) as (Row & { status: string })[]) {
    const w = plannedWorkout(item);
    if (!w || item.status === "missed") {
      if (item.watch_event_id) await clear(item.id, item.watch_event_id);
      continue;
    }
    if (item.date < today) continue; // passerade (gjorda eller kvar i veckan) lämnas som de är
    const hash = workoutHash(w);
    if (item.watch_event_id && item.watch_hash === hash) continue;
    let eventId = item.watch_event_id;
    if (eventId) {
      try {
        await updateWorkoutEvent(creds, eventId, w);
      } catch (e) {
        if (!(e instanceof IntervalsError && e.status === 404)) throw e;
        eventId = null; // borttaget i intervals – skapa på nytt
      }
    }
    if (!eventId) eventId = await createWorkoutEvent(creds, w);
    await supabase.from("plan_items").update({ watch_event_id: eventId || null, watch_hash: eventId ? hash : null }).eq("id", item.id);
    sent++;
  }
  return { sent, removed };
}
