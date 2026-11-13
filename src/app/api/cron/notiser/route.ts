import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyChallengeMedals, notifyWeeklyReview } from "@/lib/push";
import { isoDay } from "@/lib/dates";

export const maxDuration = 60;

/**
 * Schemalagt jobb (Vercel Cron, en gång per dag kl 17 UTC = 18/19 svensk tid):
 * söndagar påminnelse om veckoavstämning, varje dag koll av nya gruppmedaljer.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Nekad" }, { status: 401 });
  const admin = supabaseAdmin();
  const today = isoDay();
  const sunday = new Date(today + "T12:00:00Z").getUTCDay() === 0;
  const nextMonday = new Date(Date.parse(today + "T12:00:00Z") + 864e5).toISOString().slice(0, 10);
  const weekly = sunday ? await notifyWeeklyReview(admin, nextMonday) : 0;
  const medals = await notifyChallengeMedals(admin);
  return NextResponse.json({ ok: true, weekly, medals });
}
