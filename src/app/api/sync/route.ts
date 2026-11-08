import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { IntervalsError, getTrack, intervalsConfigured, listActivities } from "@/lib/intervals";
import { computeSplits, elevationGain, isRun, simplifyRoute, withDistance } from "@/lib/running";
import { isoDay } from "@/lib/dates";

export const maxDuration = 60;

const FIRST_SYNC_DAYS = 120;
const OVERLAP_DAYS = 3; // hämta om några dagar bakåt för att fånga ändringar
const DETAILS_PER_CALL = 6;
const DUPLICATE_WINDOW_MS = 120_000;

/**
 * Synkar pass från intervals.icu. Anropas av appen (inloggad användare, RLS).
 * Svarar { pending } > 0 om fler pass behöver detaljer – klienten anropar då igen.
 */
export async function POST() {
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  if (!intervalsConfigured()) return NextResponse.json({ error: "intervals.icu är inte konfigurerat" }, { status: 400 });

  try {
    const { data: state } = await supabase.from("sync_state").select("*").eq("provider", "intervals").maybeSingle();
    const now = new Date();
    const from = new Date(state?.last_sync_at ?? now.getTime() - FIRST_SYNC_DAYS * 864e5);
    from.setUTCDate(from.getUTCDate() - OVERLAP_DAYS);
    const oldest = isoDay(from);
    const newest = isoDay(now);

    // 1. Sammanfattningar
    const remote = await listActivities(oldest, newest);
    const { data: localRows } = await supabase
      .from("activities")
      .select("id, external_id, distance_m, moving_time_s, deleted_at")
      .eq("source", "intervals")
      .gte("start_time", new Date(oldest + "T00:00:00Z").toISOString());
    const local = new Map((localRows ?? []).map((r) => [r.external_id, r]));

    const upserts = remote.map((a) => {
      const prev = local.get(a.external_id);
      const changed = !prev || Number(prev.distance_m) !== a.distance_m || prev.moving_time_s !== a.moving_time_s;
      return {
        ...a,
        source: "intervals",
        deleted_at: null,
        updated_at: now.toISOString(),
        ...(changed ? { details_fetched: false } : {}),
      };
    });
    let created = 0;
    if (upserts.length) {
      created = upserts.filter((u) => !local.has(u.external_id)).length;
      const { error } = await supabase.from("activities").upsert(upserts, { onConflict: "user_id,source,external_id" });
      if (error) throw error;
    }

    // 2. Raderade i intervals.icu → markera som raderade här
    const remoteIds = new Set(remote.map((a) => a.external_id));
    const removed = (localRows ?? []).filter((r) => !r.deleted_at && !remoteIds.has(r.external_id)).map((r) => r.id);
    if (removed.length) {
      await supabase.from("activities").update({ deleted_at: now.toISOString() }).in("id", removed);
    }

    // 3. Dubbletter: samma pass importerat från Apple Hälsa döljs (intervals har tidsserier).
    if (remote.length) {
      const { data: apple } = await supabase
        .from("activities")
        .select("id, start_time")
        .eq("source", "apple_health")
        .is("deleted_at", null)
        .gte("start_time", new Date(oldest + "T00:00:00Z").toISOString());
      const starts = remote.map((a) => new Date(a.start_time).getTime());
      const dupes = (apple ?? [])
        .filter((r) => starts.some((s) => Math.abs(s - new Date(r.start_time).getTime()) < DUPLICATE_WINDOW_MS))
        .map((r) => r.id);
      if (dupes.length) await supabase.from("activities").update({ deleted_at: now.toISOString() }).in("id", dupes);
    }

    // 4. Detaljer (splits, rutt) för några löppass per anrop
    const { data: needDetails } = await supabase
      .from("activities")
      .select("id, external_id, sport_type, indoor")
      .eq("source", "intervals")
      .eq("details_fetched", false)
      .is("deleted_at", null)
      .order("start_time", { ascending: false })
      .limit(50);
    const runs = (needDetails ?? []).filter((r) => isRun(r.sport_type));
    const others = (needDetails ?? []).filter((r) => !isRun(r.sport_type)).map((r) => r.id);
    if (others.length) await supabase.from("activities").update({ details_fetched: true }).in("id", others);

    for (const r of runs.slice(0, DETAILS_PER_CALL)) {
      const track = withDistance(await getTrack(r.external_id));
      const patch: Record<string, unknown> = { details_fetched: true };
      if (track.length > 1) {
        patch.splits = computeSplits(track);
        const route = simplifyRoute(track);
        if (route.length > 1) patch.route = route;
        if (track.some((p) => p.ele !== undefined)) patch.elevation_gain_m = elevationGain(track);
      }
      await supabase.from("activities").update(patch).eq("id", r.id);
    }
    const pending = Math.max(0, runs.length - DETAILS_PER_CALL);

    const result = { fetched: remote.length, created, removed: removed.length, pending, at: now.toISOString() };
    await supabase.from("sync_state").upsert({
      user_id: claims.claims.sub,
      provider: "intervals",
      last_sync_at: now.toISOString(),
      last_result: result,
    });
    return NextResponse.json(result);
  } catch (e) {
    const status = e instanceof IntervalsError ? e.status : 500;
    const message =
      status === 401 || status === 403
        ? "intervals.icu nekade åtkomst – kontrollera API-nyckel och atlet-id (med \"i\" först)."
        : e instanceof Error
          ? e.message
          : "Okänt fel";
    console.error("Synk misslyckades", e);
    return NextResponse.json({ error: message }, { status: status === 401 || status === 403 ? 400 : 502 });
  }
}
