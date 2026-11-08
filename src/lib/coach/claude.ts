import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SAFETY_RULES } from "./safety";
import { costUsd, type Usage } from "./pricing";

export const CHAT_MODEL = "claude-haiku-5-5"; // vardagsfrågor – billig och snabb
export const REVIEW_MODEL = "claude-sonnet-5-5"; // veckoavstämning – starkare
export const CHAT_MAX_TOKENS = 1500; // inkl. resonemang; svaret hålls kort via instruktion
export const HISTORY_MESSAGES = 12; // antal tidigare meddelanden som skickas med

let client: Anthropic | null = null;
export function anthropic() {
  client ??= new Anthropic(); // läser ANTHROPIC_API_KEY
  return client;
}

export function claudeConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

/** Coachens redigerbara grundinstruktioner + fasta säkerhetsregler. */
export async function systemInstructions() {
  let text = "";
  try {
    text = await readFile(path.join(process.cwd(), "coach", "instruktioner.md"), "utf8");
  } catch {
    text = "Du är min personliga tränare för löpning och styrketräning. Svara på svenska.";
  }
  return `${text.trim()}\n\n${SAFETY_RULES}`;
}

/**
 * Systemprompt i tre block, från mest stabilt till mest föränderligt, med
 * cachepunkter så att instruktioner och profil läses från cache vid upprepade frågor.
 */
export function buildSystem(instructions: string, profile: string, training: string, extra?: string) {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: "text", text: instructions },
    { type: "text", text: profile, cache_control: { type: "ephemeral" } },
    { type: "text", text: training + (extra ? `\n\n${extra}` : ""), cache_control: { type: "ephemeral" } },
  ];
  return blocks;
}

export async function logUsage(supabase: SupabaseClient, kind: string, model: string, usage: Usage) {
  const cost = costUsd(model, usage);
  await supabase.from("llm_usage").insert({
    kind,
    model,
    input_tokens: usage.input_tokens ?? 0,
    cache_read_tokens: usage.cache_read_input_tokens ?? 0,
    cache_write_tokens: usage.cache_creation_input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cost_usd: cost,
  });
  return cost;
}

export function friendlyError(e: unknown) {
  if (e instanceof Anthropic.AuthenticationError) return "Claude-nyckeln saknas eller är fel (ANTHROPIC_API_KEY).";
  if (e instanceof Anthropic.PermissionDeniedError) return "Claude-kontot saknar behörighet – kontrollera nyckeln.";
  if (e instanceof Anthropic.RateLimitError) return "För många anrop just nu – försök igen om en stund.";
  if (e instanceof Anthropic.BadRequestError && /credit|billing|balance/i.test(e.message))
    return "Claude-kontot saknar krediter eller har nått sin månadsgräns.";
  if (e instanceof Anthropic.APIError) return `Claude svarade med fel (${e.status}). Försök igen.`;
  return "Något gick fel. Försök igen.";
}
