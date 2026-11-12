import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isOwner } from "../owner";

// Kostnadstak för coachchatten per person och månad. Visas aldrig som belopp i appen:
// över 80 % blir svaren kortare, över 100 % pausar chatten till nästa månad.
// Veckoavstämningen räknas in men stoppas aldrig. Ägaren har inget tak.
export const MONTHLY_CAP_USD = Number(process.env.COACH_MONTHLY_CAP_USD ?? 3); // ≈ 30 kr

export type Quota = "ok" | "low" | "out";

export async function coachQuota(supabase: SupabaseClient, email?: string | null): Promise<Quota> {
  if (isOwner(email)) return "ok";
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const { data } = await supabase.from("llm_usage").select("cost_usd").gte("created_at", monthStart);
  const used = (data ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  const share = used / MONTHLY_CAP_USD;
  return share >= 1 ? "out" : share >= 0.8 ? "low" : "ok";
}

/** "1 december" – när taket återställs. */
export function nextMonthStart() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "long", timeZone: "UTC" });
}
