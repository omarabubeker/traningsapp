import type { SupabaseClient } from "@supabase/supabase-js";
import { challengeState, type Challenge, type ChallengeProgress } from "./challenges";

export type ChallengeView = Challenge & ChallengeProgress & { state: "upcoming" | "active" | "ended"; done: boolean };

/** Aktuella challenger (pågående, kommande och nyss avslutade) med gruppens framsteg. */
export async function loadChallenges(supabase: SupabaseClient, today: string): Promise<ChallengeView[]> {
  const [{ data: rows }, { data: prog }] = await Promise.all([
    supabase.from("challenges").select("id, title, metric, target, theme, start_date, end_date").order("start_date"),
    supabase.rpc("challenge_progress"),
  ]);
  const byId = new Map(((prog ?? []) as { challenge_id: string; total: number; participants: number; mine: number; joined: boolean }[]).map((p) => [p.challenge_id, p]));
  const weekAgo = new Date(Date.parse(today + "T12:00:00Z") - 7 * 864e5).toISOString().slice(0, 10);
  return ((rows ?? []) as Challenge[])
    .filter((c) => c.end_date >= weekAgo)
    .map((c) => {
      const p = byId.get(c.id);
      const total = Number(p?.total ?? 0);
      const target = Number(c.target);
      return {
        ...c,
        target,
        total,
        participants: p?.participants ?? 0,
        mine: Number(p?.mine ?? 0),
        joined: p?.joined ?? false,
        state: challengeState(c, today),
        done: total >= target,
      };
    })
    // Pågående först, sedan kommande, sist avslutade.
    .sort((a, b) => ["active", "upcoming", "ended"].indexOf(a.state) - ["active", "upcoming", "ended"].indexOf(b.state));
}
