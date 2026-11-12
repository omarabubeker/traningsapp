import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { supabaseServer } from "@/lib/supabase/server";
import { profileBlock, trainingBlock } from "@/lib/coach/context";
import { anthropic, buildSystem, claudeConfigured, friendlyError, logUsage, REVIEW_MODEL, systemInstructions } from "@/lib/coach/claude";
import { formatDate } from "@/lib/dates";
import { randomUUID } from "node:crypto";

export const maxDuration = 180;

const PlanSchema = z.object({
  review: z.string(),
  focus: z.string(),
  items: z.array(
    z.object({
      date: z.string(),
      kind: z.enum(["run", "gym", "rest", "other"]),
      title: z.string(),
      description: z.string(),
      distance_km: z.number().nullable(),
      duration_min: z.number().nullable(),
      intensity: z.string().nullable(),
      exercises: z.array(
        z.object({ name: z.string(), sets: z.number().int(), reps: z.string(), weight_kg: z.number().nullable() }),
      ),
    }),
  ),
  memories: z.array(
    z.object({
      kind: z.enum(["advice", "plan_decision", "feedback", "injury_note", "preference", "goal"]),
      content: z.string(),
      importance: z.number().int().min(1).max(3),
    }),
  ),
});

const DAY = 864e5;
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);

export async function POST(req: Request) {
  // Första planen (från introduktionen): täcker resten av denna vecka om minst tre dagar återstår.
  const first = !!((await req.json().catch(() => ({}))) as { first?: boolean }).first;
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return Response.json({ error: "Inte inloggad" }, { status: 401 });
  if (!claudeConfigured()) return Response.json({ error: "ANTHROPIC_API_KEY saknas i Vercel." }, { status: 400 });

  try {
    const [instructions, profile, training] = await Promise.all([
      systemInstructions(),
      profileBlock(supabase),
      trainingBlock(supabase),
    ]);
    // Planera kommande vecka; på måndagar den vecka som just börjat.
    const isMonday = training.today === training.weekStart;
    const daysLeft = 7 - Math.round((Date.parse(training.today) - Date.parse(training.weekStart)) / DAY);
    const thisWeek = isMonday || (first && daysLeft >= 3);
    const weekStart = thisWeek ? training.weekStart : addDays(training.weekStart, 7);
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => !thisWeek || d >= training.today);
    const dayList = days.map((d) => `${d} (${formatDate(d + "T12:00:00Z", { weekday: "long" })})`).join(", ");

    const task = `## Uppgift: veckoavstämning
${first
  ? `1. review: det här är min första plan. Hälsa mig välkommen kort och beskriv hur du lägger upp träningen utifrån min profil,
   mitt utgångsläge och mitt mål. 3–5 meningar. Börja försiktigt om jag är ny eller tränar lite i dag.`
  : `1. review: gå igenom ${isMonday ? "förra veckan" : "veckan som gått"} – planerat mot genomfört, volym, intensitet,
   puls, återhämtning och mina återkopplingar. 3–6 meningar, konkret. Nämn tydligt om du gör upplägget lättare och varför.`}
2. focus: en mening om nästa veckas fokus och var vi är i uppbyggnaden mot huvudmålet.
3. items: ett pass per rad för dagarna ${dayList}. Använd exakt dessa datum.
   Ta med vilodagar (kind "rest"). Löppass: distance_km och/eller duration_min, intensity (t.ex. "lugnt, Z2, ca 6:20/km"
   eller "6 × 3 min i Z4, 2 min vila"). Gym: exercises med set, reps och vikt utifrån mina senaste siffror
   (weight_kg null för kroppsvikt). description: kort syfte och genomförande, 1–2 meningar.
4. memories: 0–3 viktiga beslut eller råd från denna avstämning som ska kommas ihåg.
Följ progressionsreglerna i instruktionerna. Om träningsdatan är tunn: börja försiktigt.`;

    const res = await anthropic().beta.messages.parse({
      model: REVIEW_MODEL,
      max_tokens: 10000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // om modellen avböjer körs samma anrop på Anthropics rekommenderade reservmodell
      output_config: { effort: "medium", format: betaZodOutputFormat(PlanSchema) },
      system: buildSystem(instructions, profile, training.text, task),
      messages: [{ role: "user", content: "Gör veckoavstämningen och planera nästa vecka." }],
    });
    await logUsage(supabase, "weekly", res.model ?? REVIEW_MODEL, res.usage);

    if (res.stop_reason === "refusal") return Response.json({ error: "Coachen kunde inte göra avstämningen just nu." }, { status: 502 });
    const plan = res.parsed_output;
    if (!plan) return Response.json({ error: "Coachen svarade i fel format – försök igen." }, { status: 502 });

    const items = plan.items.filter((i) => days.includes(i.date));

    // Ersätt eventuell tidigare plan för samma vecka.
    await supabase.from("plans").update({ status: "archived" }).eq("week_start", weekStart).eq("status", "active");
    const { data: saved, error } = await supabase
      .from("plans")
      .insert({ week_start: weekStart, status: "active", summary: plan.review, focus: plan.focus, model: res.model ?? REVIEW_MODEL })
      .select("id")
      .single();
    if (error || !saved) throw error ?? new Error("Kunde inte spara planen");

    if (items.length) {
      await supabase.from("plan_items").insert(
        items.map((i, n) => ({
          plan_id: saved.id,
          date: i.date,
          kind: i.kind,
          title: i.title,
          description: i.description,
          target: {
            distance_km: i.distance_km,
            duration_min: i.duration_min,
            intensity: i.intensity,
            exercises: i.exercises.length ? i.exercises : undefined,
          },
          sort: n,
        })),
      );
    }

    // Lägg avstämningen i chatten så att den syns och blir en del av historiken.
    // Varje veckoavstämning startar ett nytt samtal.
    const conversationId = randomUUID();
    await supabase.from("coach_messages").insert({ role: "user", kind: "weekly", content: "Veckoavstämning", conversation_id: conversationId });
    const { data: msg } = await supabase
      .from("coach_messages")
      .insert({ role: "assistant", kind: "weekly", conversation_id: conversationId, content: `${plan.review}\n\n**Nästa vecka:** ${plan.focus}\n\nPlanen finns under Plan.` })
      .select("id")
      .single();
    if (plan.memories.length) {
      await supabase.from("coach_memory").insert(
        plan.memories.map((m) => ({ kind: m.kind, content: m.content, importance: m.importance, source_message_id: msg?.id ?? null })),
      );
    }
    return Response.json({ ok: true, weekStart, items: items.length });
  } catch (e) {
    console.error("Veckoavstämning", e);
    return Response.json({ error: friendlyError(e) }, { status: 502 });
  }
}
