"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MovementKey } from "./types";
import type { TechniqueSummary } from "./session";
import { MOVEMENTS } from "./registry";

/**
 * Sparar ett kameraset som ett vanligt gymset (i pågående pass eller ett nytt kamerapass)
 * plus teknikresultatet. Returnerar passets id.
 */
export async function saveCameraSet(
  supabase: SupabaseClient,
  key: MovementKey,
  summary: TechniqueSummary,
  weightKg: number,
  model: string,
): Promise<string> {
  const rule = MOVEMENTS[key];

  // Övningen som hör till kameraregeln (skapas om den saknas).
  let { data: ex } = await supabase.from("exercises").select("id").eq("movement_key", key).maybeSingle();
  if (!ex) {
    const { data, error } = await supabase
      .from("exercises")
      .insert({ name: rule.name, movement_key: key, is_bodyweight: key === "plank", muscle_group: key === "plank" ? "Bål" : "Ben" })
      .select("id")
      .single();
    if (error) throw error;
    ex = data;
  }

  // Pågående pass från idag, annars ett nytt kamerapass.
  const since = new Date(Date.now() - 6 * 3600e3).toISOString();
  let { data: session } = await supabase
    .from("gym_sessions")
    .select("id")
    .is("ended_at", null)
    .gte("started_at", since)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) {
    const { data, error } = await supabase.from("gym_sessions").insert({ source: "camera" }).select("id").single();
    if (error) throw error;
    session = data;
  }

  const { count } = await supabase
    .from("gym_sets")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .eq("exercise_id", ex.id);

  const hold = rule.kind === "hold";
  const { data: set, error: setErr } = await supabase
    .from("gym_sets")
    .insert({
      id: crypto.randomUUID(),
      session_id: session.id,
      exercise_id: ex.id,
      set_no: (count ?? 0) + 1,
      reps: hold ? 0 : summary.reps,
      weight_kg: hold ? 0 : weightKg,
      duration_s: hold ? summary.holdS : null,
    })
    .select("id")
    .single();
  if (setErr) throw setErr;

  const { error: tErr } = await supabase.from("technique_results").insert({
    gym_set_id: set.id,
    movement_key: key,
    reps: summary.reps,
    good_reps: summary.goodReps,
    hold_s: hold ? summary.holdS : null,
    faults: summary.faults,
    metrics: { ...summary.metrics, ...(summary.perSide ? { left: summary.perSide.left, right: summary.perSide.right } : {}) },
    model,
  });
  if (tErr) throw tErr;
  return session.id;
}
