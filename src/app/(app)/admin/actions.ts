"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { isOwner } from "@/lib/owner";
import { newToken, type Member } from "@/lib/members";

async function ownerOnly() {
  const { user } = await requireUser();
  if (!isOwner(user.email)) throw new Error("Bara ägaren kan göra det här.");
  return { admin: supabaseAdmin(), user };
}

export type ActionResult = { ok: boolean; error?: string };

export async function addMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { admin } = await ownerOnly();
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Fyll i namn och en giltig e-post." };
  const { error } = await admin.from("members").insert({ name, email, token: newToken() });
  if (error) return { ok: false, error: /duplicate|unique/i.test(error.message) ? "Den e-posten finns redan." : "Kunde inte lägga till." };
  revalidatePath("/admin");
  return { ok: true };
}

export async function newLink(id: string) {
  const { admin } = await ownerOnly();
  await admin.from("members").update({ token: newToken() }).eq("id", id);
  revalidatePath("/admin");
}

/** Stänger av eller aktiverar en person. Avstängd: länken slutar fungera och kontot spärras direkt. */
export async function setActive(id: string, active: boolean) {
  const { admin, user } = await ownerOnly();
  const { data } = await admin.from("members").select("*").eq("id", id).single();
  const m = data as Member;
  if (m.user_id === user.id) return; // ägaren kan inte stänga av sig själv
  await admin.from("members").update({ active }).eq("id", id);
  if (m.user_id) await admin.auth.admin.updateUserById(m.user_id, { ban_duration: active ? "none" : "876000h" });
  revalidatePath("/admin");
}

/** Tar bort personen helt, inklusive all träningsdata. */
export async function removeMember(id: string) {
  const { admin, user } = await ownerOnly();
  const { data } = await admin.from("members").select("*").eq("id", id).single();
  const m = data as Member;
  if (m.user_id === user.id) return;
  if (m.user_id) await admin.auth.admin.deleteUser(m.user_id);
  await admin.from("members").delete().eq("id", id);
  revalidatePath("/admin");
}

/** Skapar en gruppchallenge (bara ägaren). */
export async function createChallenge(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { admin } = await ownerOnly();
  const metric = String(form.get("metric") ?? "");
  const title = String(form.get("title") ?? "").trim().slice(0, 60);
  const target = Number(String(form.get("target") ?? "").replace(",", "."));
  const theme = String(form.get("theme") ?? "").trim() || null;
  const start = String(form.get("start") ?? "");
  const end = String(form.get("end") ?? "");
  if (!["km", "sessions", "kg"].includes(metric)) return { ok: false, error: "Välj typ av challenge." };
  if (!title) return { ok: false, error: "Ge challengen ett namn." };
  if (!(target > 0)) return { ok: false, error: "Skriv ett mål större än noll." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) return { ok: false, error: "Kolla datumen – slutet måste vara efter starten." };
  const { error } = await admin.from("challenges").insert({ metric, title, target, theme, start_date: start, end_date: end });
  if (error) return { ok: false, error: "Kunde inte skapa challengen." };
  revalidatePath("/admin");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteChallenge(id: string) {
  const { admin } = await ownerOnly();
  await admin.from("challenges").delete().eq("id", id);
  revalidatePath("/admin");
  revalidatePath("/");
}
