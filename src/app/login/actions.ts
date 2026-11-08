"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginState = { error?: string; email?: string };

function isAllowed(email: string) {
  const allowed = (process.env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const fail: LoginState = { email, error: "Fel e-post eller lösenord." };
  if (!email || !password) return { email, error: "Fyll i e-post och lösenord." };
  if (!isAllowed(email)) return fail;

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error?.status === 429) return { email, error: "För många försök. Vänta en stund." };
    return fail;
  }

  // Första inloggningen: lägg in startövningar.
  const { count } = await supabase.from("exercises").select("id", { count: "exact", head: true });
  if (!count) await supabase.rpc("seed_exercises");

  redirect("/");
}

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
