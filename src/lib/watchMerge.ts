// Slår ihop styrkepass från klockan med gympass som loggats i appen.
// Ett klockpass räknas som samma pass om det överlappar gympasset (±30 min marginal).

const MARGIN_MS = 30 * 60e3;
const OPEN_SESSION_MS = 3 * 3600e3; // pågående pass utan sluttid

type WatchLike = { id: string; sport_type: string; start_time: string; moving_time_s?: number | null; elapsed_time_s?: number | null };
type SessionLike = { id: string; started_at: string; ended_at: string | null };

export const isWatchStrength = (sport: string) => /^(Strength|WeightTraining)$/i.test(sport);

/** Karta klockpass-id → gympass-id för överlappande pass. */
export function matchWatchToGym(activities: WatchLike[], sessions: SessionLike[]) {
  const map = new Map<string, string>();
  for (const a of activities) {
    if (!isWatchStrength(a.sport_type)) continue;
    const aStart = Date.parse(a.start_time);
    const aEnd = aStart + 1000 * (a.elapsed_time_s ?? a.moving_time_s ?? 0);
    let best: { id: string; overlap: number } | null = null;
    for (const s of sessions) {
      const sStart = Date.parse(s.started_at) - MARGIN_MS;
      const sEnd = (s.ended_at ? Date.parse(s.ended_at) : Date.parse(s.started_at) + OPEN_SESSION_MS) + MARGIN_MS;
      const overlap = Math.min(aEnd, sEnd) - Math.max(aStart, sStart);
      if (overlap >= 0 && (!best || overlap > best.overlap)) best = { id: s.id, overlap };
    }
    if (best) map.set(a.id, best.id);
  }
  return map;
}
