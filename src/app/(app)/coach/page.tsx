import { requireUser } from "@/lib/supabase/server";
import { groupConversations, historySince, type ConvMessage } from "@/lib/coach/conversation";
import { CoachChat } from "./CoachChat";
import { coachQuota, nextMonthStart } from "@/lib/coach/quota";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const { supabase, user } = await requireUser();
  const quota = await coachQuota(supabase, user.email);
  const since = historySince();
  const { data } = await supabase
    .from("coach_messages")
    .select("id, role, kind, content, created_at, conversation_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(400);
  const { current, previous } = groupConversations(((data ?? []) as ConvMessage[]).reverse());
  return <CoachChat current={current?.messages ?? []} previous={previous} configured={!!process.env.ANTHROPIC_API_KEY} quotaNote={quota === "ok" ? null : quota === "low" ? `Coachen har varit flitig den här månaden – svaren blir kortare fram till ${nextMonthStart()}.` : `Chatten pausar till ${nextMonthStart()}. Veckoavstämningen fungerar som vanligt.`} />;
}
