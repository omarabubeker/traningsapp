import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Klient med service role-nyckeln (SUPABASE_SECRET_KEY i Vercel). Kringgår RLS – används bara
 * på servern för inloggningslänkar och ägarens admin-vy. Får aldrig nå webbläsaren.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY saknas i Vercel.");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
