import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { IntervalsError, getIntervalsCreds, listActivities, normalizeAthleteId, verifyCreds, type IntervalsCreds } from "@/lib/intervals";
import { isoDay } from "@/lib/dates";

const BRANDS = ["apple", "garmin", "polar", "coros", "suunto", "wahoo", "other"];

async function user() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  return { supabase, claims: data?.claims };
}

/** Senaste passet de senaste 30 dagarna – visar att hela kedjan klocka → intervals.icu → appen fungerar. */
async function latest(creds: IntervalsCreds) {
  const now = new Date();
  const list = await listActivities(creds, isoDay(new Date(now.getTime() - 30 * 864e5)), isoDay(now));
  const a = list.sort((x, y) => y.start_time.localeCompare(x.start_time))[0];
  return a ? { sport: a.sport_type, start: a.start_time, km: a.distance_m ? Math.round(a.distance_m / 100) / 10 : null, count: list.length } : { count: 0 };
}

function friendly(e: unknown) {
  if (e instanceof IntervalsError) {
    if (e.status === 401 || e.status === 403) return "intervals.icu godkände inte nyckeln. Kontrollera API-nyckeln och athlete-id:t.";
    if (e.status === 404) return "Hittade inget konto med det athlete-id:t.";
    return `intervals.icu svarade med fel (${e.status}). Försök igen om en stund.`;
  }
  return "Kunde inte nå intervals.icu. Försök igen om en stund.";
}

/** Koppla: kontrollera nyckeln hos intervals.icu och spara den krypterat. */
export async function POST(req: Request) {
  const { supabase, claims } = await user();
  if (!claims?.sub) return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { athleteId?: string; apiKey?: string; brand?: string };
  const athleteId = normalizeAthleteId(String(body.athleteId ?? ""));
  const apiKey = String(body.apiKey ?? "").trim();
  const brand = BRANDS.includes(String(body.brand)) ? String(body.brand) : "other";
  if (!/^i\d+$/.test(athleteId)) return NextResponse.json({ error: "Athlete-id ska se ut som i123456." }, { status: 400 });
  if (apiKey.length < 10 || apiKey.length > 200) return NextResponse.json({ error: "API-nyckeln ser inte rätt ut." }, { status: 400 });

  const creds = { athleteId, apiKey };
  try {
    const { name } = await verifyCreds(creds);
    const { error } = await supabase.rpc("save_intervals_connection", { p_athlete: athleteId, p_key: apiKey, p_brand: brand, p_name: name });
    if (error) throw error;
    return NextResponse.json({ ok: true, name, latest: await latest(creds).catch(() => null) });
  } catch (e) {
    console.error("klocka koppla", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: e instanceof IntervalsError ? friendly(e) : "Kunde inte spara kopplingen." }, { status: 400 });
  }
}

/** Testa kopplingen: hämtar senaste passet. */
export async function GET() {
  const { supabase, claims } = await user();
  if (!claims?.sub) return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  const creds = await getIntervalsCreds(supabase, claims.email as string | undefined);
  if (!creds) return NextResponse.json({ error: "Klockan är inte kopplad." }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, latest: await latest(creds) });
  } catch (e) {
    return NextResponse.json({ error: friendly(e) }, { status: 400 });
  }
}

/** Koppla från: tar bort nyckeln. */
export async function DELETE() {
  const { supabase, claims } = await user();
  if (!claims?.sub) return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  const { error } = await supabase.rpc("delete_intervals_connection");
  if (error) return NextResponse.json({ error: "Kunde inte koppla från." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
