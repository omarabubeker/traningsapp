import { requireUser } from "@/lib/supabase/server";
import { CoachChat, type ChatMessage } from "./CoachChat";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("coach_messages")
    .select("id, role, kind, content, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  const messages = ((data ?? []) as ChatMessage[]).reverse();
  return <CoachChat initial={messages} configured={!!process.env.ANTHROPIC_API_KEY} />;
}
