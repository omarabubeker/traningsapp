import { after } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { supabaseServer } from "@/lib/supabase/server";
import { profileBlock, trainingBlock } from "@/lib/coach/context";
import {
  anthropic,
  buildSystem,
  CHAT_MAX_TOKENS,
  CHAT_MODEL,
  claudeConfigured,
  friendlyError,
  HISTORY_MESSAGES,
  logUsage,
  systemInstructions,
} from "@/lib/coach/claude";
import { extractMemories } from "@/lib/coach/memory";

export const maxDuration = 60;

const STYLE = `## Svar i chatten
Svara kort: oftast 2–6 meningar eller en kort lista, högst cirka 150 ord om jag inte ber om mer.
Använd träningsdatan ovan när den är relevant och hitta inte på pass eller siffror som inte finns där.`;

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return Response.json({ error: "Inte inloggad" }, { status: 401 });
  if (!claudeConfigured()) return Response.json({ error: "ANTHROPIC_API_KEY saknas i Vercel." }, { status: 400 });

  const { message } = (await req.json()) as { message?: string };
  const text = (message ?? "").trim().slice(0, 4000);
  if (!text) return Response.json({ error: "Tomt meddelande" }, { status: 400 });

  const { data: userMsg, error: saveError } = await supabase
    .from("coach_messages")
    .insert({ role: "user", content: text })
    .select("id")
    .single();
  if (saveError) {
    console.error("Kunde inte spara meddelande", saveError);
    const missing = /does not exist|schema cache|relation/i.test(saveError.message);
    return Response.json(
      { error: missing ? "Databasen saknar coachens tabeller – kör 0003_etapp3_coach.sql i Supabase → SQL Editor." : `Kunde inte spara meddelandet: ${saveError.message}` },
      { status: 500 },
    );
  }

  const [instructions, profile, training, { data: history }] = await Promise.all([
    systemInstructions(),
    profileBlock(supabase),
    trainingBlock(supabase),
    supabase
      .from("coach_messages")
      .select("role, content")
      .order("created_at", { ascending: false })
      .limit(HISTORY_MESSAGES + 1),
  ]);

  // Historik i rätt ordning; API:et kräver att första meddelandet är från användaren.
  const msgs: Anthropic.MessageParam[] = (history ?? [])
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  // Slå ihop meddelanden i rad från samma avsändare (t.ex. efter ett misslyckat svar).
  const merged: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of msgs as { role: "user" | "assistant"; content: string }[]) {
    const last = merged.at(-1);
    if (last && last.role === m.role) last.content += "\n\n" + m.content;
    else merged.push({ ...m });
  }
  // Frågan som just ställdes ska alltid vara sist, även om historiken inte gick att läsa.
  if (merged.at(-1)?.role !== "user" || !merged.at(-1)!.content.endsWith(text)) merged.push({ role: "user", content: text });

  const stream = anthropic().messages.stream({
    model: CHAT_MODEL,
    max_tokens: CHAT_MAX_TOKENS,
    output_config: { effort: "low" },
    system: buildSystem(instructions, profile, training.text, STYLE),
    messages: merged,
  });

  // Det som ska göras när svaret är klart (förbrukning, minne) körs efter svaret
  // med after(), så att Vercel låter funktionen jobba klart.
  let finish!: (r: { answer: string; final: Anthropic.Message | null; savedId: string | null }) => void;
  const finished = new Promise<{ answer: string; final: Anthropic.Message | null; savedId: string | null }>((r) => (finish = r));
  after(async () => {
    const { answer, final, savedId } = await finished;
    if (!final) return;
    await logUsage(supabase, "chat", final.model ?? CHAT_MODEL, final.usage);
    await extractMemories(supabase, text, answer, savedId ?? userMsg?.id ?? null).catch((e) => console.error("Minne", e));
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let final: Anthropic.Message | null = null;
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            answer += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          const note = "\n\nJag kan inte svara på det här. Vid besvär – kontakta vården (1177).";
          answer += note;
          controller.enqueue(encoder.encode(note));
        }
        // Spara svaret innan strömmen stängs, så att nästa fråga ser det i historiken.
        const { data: saved } = await supabase
          .from("coach_messages")
          .insert({ role: "assistant", content: answer.trim() || "(inget svar)" })
          .select("id")
          .single();
        finish({ answer, final, savedId: saved?.id ?? null });
      } catch (e) {
        console.error("Coach-chatt", e);
        controller.enqueue(encoder.encode(`\n\n⚠️ ${friendlyError(e)}`));
        finish({ answer, final, savedId: null });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
