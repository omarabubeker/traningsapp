import { requireUser } from "@/lib/supabase/server";
import { groupConversations, historySince, type ConvMessage } from "@/lib/coach/conversation";
import { CoachChat } from "./CoachChat";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const { supabase } = await requireUser();
  const since = historySince();
  const { data } = await supabase
    .from("coach_messages")
    .select("id, role, kind, content, created_at, conversation_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(400);
  const { current, previous } = groupConversations(((data ?? []) as ConvMessage[]).reverse());
  return <CoachChat current={current?.messages ?? []} previous={previous} configured={!!process.env.ANTHROPIC_API_KEY} />;
}
