import "server-only";
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

export const pushConfigured = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function setup() {
  if (ready) return;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "https://traningsapp.vercel.app", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

/** Skickar till alla telefoner för de angivna personerna. Utgångna prenumerationer tas bort. */
export async function sendPush(admin: SupabaseClient, userIds: string[], msg: PushMessage) {
  if (!pushConfigured() || !userIds.length) return 0;
  setup();
  const { data } = await admin.from("push_subscriptions").select("*").in("user_id", userIds);
  let sent = 0;
  for (const s of (data ?? []) as Sub[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("Push misslyckades", code, (e as Error).message);
    }
  }
  return sent;
}

/** Gruppmedalj: notis till deltagarna (som vill ha den) första gången en challenge når målet. */
export async function notifyChallengeMedals(admin: SupabaseClient) {
  const [{ data: prog }, { data: done }, { data: chs }] = await Promise.all([
    admin.rpc("challenge_progress"),
    admin.from("challenge_notified").select("challenge_id"),
    admin.from("challenges").select("id, title, target"),
  ]);
  const already = new Set((done ?? []).map((d) => d.challenge_id as string));
  let count = 0;
  for (const p of (prog ?? []) as { challenge_id: string; total: number }[]) {
    const c = (chs ?? []).find((x) => x.id === p.challenge_id);
    if (!c || already.has(c.id) || Number(p.total) < Number(c.target)) continue;
    // Markera först så att två samtidiga körningar inte skickar dubbelt.
    const { error } = await admin.from("challenge_notified").insert({ challenge_id: c.id });
    if (error) continue;
    const { data: members } = await admin.from("challenge_members").select("user_id").eq("challenge_id", c.id);
    const ids = (members ?? []).map((m) => m.user_id as string);
    const { data: wants } = ids.length ? await admin.from("profile").select("user_id").in("user_id", ids).eq("notify_medals", true) : { data: [] };
    count += await sendPush(admin, (wants ?? []).map((w) => w.user_id as string), {
      title: "Gruppmedalj! 🏅",
      body: `Ni klarade ${c.title} tillsammans. Grattis allihop!`,
      url: "/",
      tag: `medalj-${c.id}`,
    });
  }
  return count;
}

/** Söndagspåminnelse till dem som vill ha den och ännu inte har nästa veckas plan. */
export async function notifyWeeklyReview(admin: SupabaseClient, nextMonday: string) {
  const [{ data: subs }, { data: planned }, { data: off }] = await Promise.all([
    admin.from("push_subscriptions").select("user_id"),
    admin.from("plans").select("user_id").eq("status", "active").eq("week_start", nextMonday),
    admin.from("profile").select("user_id").eq("notify_weekly", false),
  ]);
  const skip = new Set([...(planned ?? []), ...(off ?? [])].map((r) => r.user_id as string));
  const ids = [...new Set((subs ?? []).map((s) => s.user_id as string))].filter((id) => !skip.has(id));
  return sendPush(admin, ids, {
    title: "Dags för veckoavstämning",
    body: "Coachen går igenom veckan och gör nästa veckas plan.",
    url: "/coach",
    tag: "veckoavstamning",
  });
}
