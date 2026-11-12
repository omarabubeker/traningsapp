import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Member } from "@/lib/members";

/**
 * Personlig inloggningslänk: /in/<nyckel>. Skapar kontot första gången och loggar in
 * direkt – inget lösenord, ingen kod. Avstängda eller okända länker går till /login.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = new URL(req.url).origin;
  const fail = (why: string) => NextResponse.redirect(`${origin}/login?lank=${why}`);
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) return fail("ogiltig");

  const admin = supabaseAdmin();
  const { data } = await admin.from("members").select("*").eq("token", token).maybeSingle();
  const member = data as Member | null;
  if (!member) return fail("ogiltig");
  if (!member.active) return fail("avstangd");

  // Kontot skapas första gången (bekräftat direkt – inget mejl skickas).
  let userId = member.user_id;
  if (!userId) {
    const { data: created, error } = await admin.auth.admin.createUser({ email: member.email, email_confirm: true, user_metadata: { name: member.name } });
    if (created?.user) userId = created.user.id;
    else if (error && !/already/i.test(error.message)) {
      console.error("in: createUser", error.message);
      return fail("fel");
    }
  }

  // Engångsinloggning som skapas på servern och löses in direkt (sätter sessionskakorna).
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: member.email });
  if (linkError || !link?.properties?.hashed_token) {
    console.error("in: generateLink", linkError?.message);
    return fail("fel");
  }
  const supabase = await supabaseServer();
  const { data: session, error } = await supabase.auth.verifyOtp({ type: "email", token_hash: link.properties.hashed_token });
  if (error || !session.user) {
    console.error("in: verifyOtp", error?.message);
    return fail("fel");
  }

  await admin.from("members").update({ user_id: session.user.id, last_login_at: new Date().toISOString() }).eq("id", member.id);

  // Första inloggningen: lägg in startövningar (som vid lösenordsinloggning).
  const { count } = await supabase.from("exercises").select("id", { count: "exact", head: true });
  if (!count) await supabase.rpc("seed_exercises");

  return NextResponse.redirect(`${origin}/`);
}
