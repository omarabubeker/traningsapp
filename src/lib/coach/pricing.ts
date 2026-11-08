// Ungefärliga priser i USD per miljon tokens (Claude API, november 2026).
// Cache-läsning ≈ 0,1 × inpris (0,05 × för Opus 5.5), cache-skrivning (5 min) = 1,25 × inpris.
const PRICES: Record<string, { input: number; output: number; cacheRead?: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-opus-4-8": { input: 5, output: 25 },
};

export type Usage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
};

export function costUsd(model: string, u: Usage): number {
  const p = PRICES[model] ?? PRICES["claude-sonnet-5-5"];
  const read = p.cacheRead ?? p.input * 0.1;
  return (
    ((u.input_tokens ?? 0) * p.input +
      (u.cache_read_input_tokens ?? 0) * read +
      (u.cache_creation_input_tokens ?? 0) * p.input * 1.25 +
      (u.output_tokens ?? 0) * p.output) /
    1_000_000
  );
}

export const USD_TO_SEK = 10.5; // ungefärlig växelkurs för visning
