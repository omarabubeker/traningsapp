"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type LoginState = { step: "email" | "code"; email?: string; error?: string; info?: string };

function isAllowed(email: string) {
  const allowed = (process.env.ALLOWED_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  if (!email) return { step: "email", error: "Fyll i din e-post." };

  // Okända adresser får samma svar som kända, men inget mejl skickas.
  if (!isAllowed(email)) {
    return { step: "code", email, info: "Om adressen är godkänd har en kod skickats." };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    const wait = error.status === 429 || /rate|seconds/i.test(error.message);
    return {
      step: "email",
      email,
      error: wait ? "För många försök. Vänta en minut och försök igen." : "Kunde inte skicka kod. Försök igen.",
    };
  }
  return { step: "code", email, info: "Vi har mejlat en kod till dig." };
}

export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { step: "code", email, error: "Koden har minst 6 siffror." };
  if (!isAllowed(email)) return { step: "code", email, error: "Fel kod eller utgången kod." };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) return { step: "code", email, error: "Fel kod eller utgången kod." };

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
