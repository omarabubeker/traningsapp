import type { Cue } from "./types";

/** Samma instruktion upprepas tidigast efter så här många ms. */
export const REPEAT_MS = 3500;
/** Minsta tid mellan två olika instruktioner (så att texten hinner läsas). */
export const MIN_GAP_MS = 1500;

/**
 * Väljer högst en instruktion åt gången: högst prioritet först (säkerhet → fel → beröm),
 * och samma instruktion visas/sägs inte oftare än var 3,5 s.
 */
export class CueScheduler {
  private lastShown = new Map<string, number>();
  private lastAny = -Infinity;

  constructor(private repeatMs = REPEAT_MS, private minGapMs = MIN_GAP_MS) {}

  pick(cues: Cue[], now: number): Cue | null {
    if (!cues.length || now - this.lastAny < this.minGapMs) return null;
    const sorted = [...cues].sort((a, b) => a.priority - b.priority);
    for (const c of sorted) {
      const last = this.lastShown.get(c.id) ?? -Infinity;
      if (now - last >= this.repeatMs) {
        this.lastShown.set(c.id, now);
        this.lastAny = now;
        return c;
      }
    }
    return null;
  }

  reset() {
    this.lastShown.clear();
    this.lastAny = -Infinity;
  }
}
