import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { pushConfigured, sendPush } from "@/lib/push";

/** Skickar en testnotis till den inloggades telefoner. */
export async function POST() {
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.json({ error: "Inte inloggad" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "Notiser är inte uppsatta i Vercel än." }, { status: 400 });
  const sent = await sendPush(supabase, [claims.claims.sub], { title: "Det funkar! 🎉", body: "Så här ser notiserna från träningsappen ut.", url: "/profil", tag: "test" });
  if (!sent) return NextResponse.json({ error: "Hittade ingen telefon att skicka till – aktivera notiser igen." }, { status: 400 });
  return NextResponse.json({ ok: true, sent });
}
