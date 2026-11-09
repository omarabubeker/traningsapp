import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const NEW_CONVERSATION_AFTER_MS = 12 * 3600e3; // uppehåll som startar nytt samtal
export const KEEP_DAYS = 90; // äldre meddelanden gallras; minnet finns kvar

/** Pågående samtal, eller ett nytt om det gått länge sedan senaste meddelandet. */
export async function currentConversation(supabase: SupabaseClient, forceNew = false): Promise<string> {
  if (forceNew) return randomUUID();
  const { data: last } = await supabase
    .from("coach_messages")
    .select("conversation_id, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!last || Date.now() - Date.parse(last.created_at) > NEW_CONVERSATION_AFTER_MS) return randomUUID();
  return last.conversation_id as string;
}

export async function pruneOldMessages(supabase: SupabaseClient) {
  const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  await supabase.from("coach_messages").delete().lt("created_at", cutoff);
}

export type ConvMessage = { id: string; role: "user" | "assistant"; kind: "chat" | "weekly"; content: string; created_at: string; conversation_id: string };
export type Conversation = { id: string; startedAt: string; messages: ConvMessage[] };

/** Delar upp meddelanden i samtal, äldst först. Det senaste räknas som pågående om det är färskt. */
export function groupConversations(messages: ConvMessage[], now = Date.now()) {
  const map = new Map<string, Conversation>();
  for (const m of messages) {
    const c = map.get(m.conversation_id) ?? { id: m.conversation_id, startedAt: m.created_at, messages: [] };
    c.messages.push(m);
    map.set(m.conversation_id, c);
  }
  const all = [...map.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const last = all.at(-1);
  const lastAt = last?.messages.at(-1)?.created_at;
  const fresh = last && lastAt && now - Date.parse(lastAt) <= NEW_CONVERSATION_AFTER_MS;
  return { current: fresh ? last : null, previous: fresh ? all.slice(0, -1) : all };
}

/** Tidigaste tidpunkt som visas i chatten. */
export function historySince() {
  return new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
}
