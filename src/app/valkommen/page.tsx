import { requireUser } from "@/lib/supabase/server";
import { loadUserGoals } from "@/lib/goalsData";
import { getIntervalsCreds } from "@/lib/intervals";
import type { Profile } from "@/lib/types";
import type { WatchStatus } from "@/components/WatchConnect";
import { Onboarding } from "./Onboarding";

export const dynamic = "force-dynamic";

/** Introduktionen för nya användare (kan öppnas igen från Profil). */
export default async function ValkommenPage() {
  const { supabase, user } = await requireUser();
  const [{ data: profile }, goals, { data: conn }, creds] = await Promise.all([
    supabase.from("profile").select("*").maybeSingle(),
    loadUserGoals(supabase),
    supabase.from("watch_connections").select("athlete_id, athlete_name, brand").maybeSingle(),
    getIntervalsCreds(supabase, user.email),
  ]);
  const watch: WatchStatus = conn
    ? { source: "own", athleteId: conn.athlete_id, name: conn.athlete_name, brand: conn.brand }
    : { source: creds ? "env" : null };
  const p = profile as Profile | null;
  return <Onboarding userId={user.id} profile={p} goal={goals.primary} watch={watch} again={!!p?.onboarded_at} />;
}
