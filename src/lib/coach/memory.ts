import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anthropic, CHAT_MODEL, logUsage } from "./claude";

const MemorySchema = z.object({
  memories: z.array(
    z.object({
      kind: z.enum(["advice", "plan_decision", "feedback", "injury_note", "preference", "goal"]),
      content: z.string(),
      importance: z.number().int().min(1).max(3),
      valid_days: z.number().int().nullable(),
    }),
  ),
});

const PROMPT = `Du sparar minnesanteckningar åt en träningscoach. Läs utbytet nedan och plocka ut
det som är värt att komma ihåg i kommande veckor:
- feedback: hur jag mår/kändes (t.ex. "trött i dag", "knät kändes ok efter långpasset")
- injury_note: känningar, skador, smärta
- advice: konkreta råd coachen gav som ska följas upp
- plan_decision: beslut om upplägget (t.ex. "flyttar långpasset till söndagar")
- preference: hur jag vill träna eller bli coachad
- goal: nya eller ändrade mål
Skriv varje anteckning som en kort, självständig mening på svenska med datum om det spelar roll.
Hoppa över småprat, allmänna frågor och sådant som redan finns bland befintliga anteckningar.
valid_days: hur många dagar anteckningen är relevant (t.ex. 7 för dagsform, null för permanent).
importance: 3 = viktigt (skada, mål), 2 = normalt, 1 = mindre viktigt. Returnera en tom lista om inget är värt att spara.`;

export async function extractMemories(
  supabase: SupabaseClient,
  userText: string,
  assistantText: string,
  sourceMessageId: string | null,
) {
  const { data: existing } = await supabase
    .from("coach_memory")
    .select("content")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(30);
  const today = new Date().toISOString().slice(0, 10);

  const res = await anthropic().messages.parse({
    model: CHAT_MODEL,
    max_tokens: 1200,
    output_config: { effort: "low", format: zodOutputFormat(MemorySchema) },
    system: PROMPT,
    messages: [
      {
        role: "user",
        content: `Datum: ${today}\n\nBefintliga anteckningar:\n${(existing ?? []).map((m) => `- ${m.content}`).join("\n") || "(inga)"}\n\nJag skrev:\n${userText}\n\nCoachen svarade:\n${assistantText}`,
      },
    ],
  });
  await logUsage(supabase, "memory", CHAT_MODEL, res.usage);
  const items = res.parsed_output?.memories ?? [];
  if (!items.length) return 0;
  await supabase.from("coach_memory").insert(
    items.map((m) => ({
      kind: m.kind,
      content: m.content,
      importance: m.importance,
      valid_until: m.valid_days ? new Date(Date.now() + m.valid_days * 864e5).toISOString().slice(0, 10) : null,
      source_message_id: sourceMessageId,
    })),
  );
  return items.length;
}
