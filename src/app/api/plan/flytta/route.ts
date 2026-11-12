import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getIntervalsCreds } from "@/lib/intervals";
import { syncPlanToWatch } from "@/lib/watchPlanSync";
import { mondayOf } from "@/lib/coach/planData";
import { isoDay } from "@/lib/dates";

/** Flyttar ett pass till en annan dag i samma vecka – och på klockan om den är kopplad. */
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  const { id, date } = (await req.json().catch(() => ({}))) as { id?: string; date?: string };
  if (!id || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Ogiltig dag" }, { status: 400 });

  const { data: item } = await supabase.from("plan_items").select("id, date").eq("id", id).maybeSingle();
  if (!item) return NextResponse.json({ error: "Passet finns inte" }, { status: 404 });
  if (mondayOf(date) !== mondayOf(item.date) || date < isoDay()) return NextResponse.json({ error: "Välj en dag från idag och framåt i samma vecka." }, { status: 400 });

  const { error } = await supabase.from("plan_items").update({ date }).eq("id", id);
  if (error) return NextResponse.json({ error: "Kunde inte flytta passet" }, { status: 500 });

  let watch = false;
  try {
    const creds = await getIntervalsCreds(supabase, claims.claims.email as string | undefined);
    if (creds) {
      await syncPlanToWatch(supabase, creds);
      watch = true;
    }
  } catch (e) {
    console.error("Flytta på klockan", e);
  }
  return NextResponse.json({ ok: true, watch });
}
