import type { MovementRule, RuleOutput } from "./types";

export type TechniqueSummary = {
  reps: number;
  goodReps: number;
  holdS: number;
  faults: Record<string, number>; // fel → antal reps (eller sekunder för hållövningar)
  topFaults: { key: string; label: string; count: number }[];
  metrics: Record<string, number>; // snittvärden
  perSide?: { left: number; right: number };
};

/** Samlar ihop resultatet från en regel under ett set. Ren logik, testbar. */
export class TechniqueSession {
  reps = 0;
  goodReps = 0;
  holdMs = 0;
  private faults: Record<string, number> = {};
  private faultMs: Record<string, number> = {};
  private metricSums: Record<string, number> = {};
  private sides = { left: 0, right: 0 };
  private lastT: number | null = null;

  constructor(private rule: MovementRule<never>) {}

  add(out: RuleOutput<unknown>, t: number) {
    const dt = this.lastT === null ? 0 : Math.min(200, t - this.lastT);
    this.lastT = t;
    if (out.rep) {
      this.reps++;
      if (out.rep.good) this.goodReps++;
      for (const f of out.rep.faults) this.faults[f] = (this.faults[f] ?? 0) + 1;
      for (const [k, v] of Object.entries(out.rep.metrics)) this.metricSums[k] = (this.metricSums[k] ?? 0) + v;
      if (out.rep.side) this.sides[out.rep.side]++;
    }
    if (out.holdMs) this.holdMs += out.holdMs;
    for (const f of out.frameFaults ?? []) this.faultMs[f] = (this.faultMs[f] ?? 0) + dt;
  }

  summary(): TechniqueSummary {
    const hold = this.rule.kind === "hold";
    const faults: Record<string, number> = hold
      ? Object.fromEntries(
          Object.entries(this.faultMs)
            .map(([k, ms]): [string, number] => [k, Math.round(ms / 1000)])
            .filter(([, sec]) => sec >= 1),
        )
      : { ...this.faults };
    const metrics = Object.fromEntries(
      Object.entries(this.metricSums).map(([k, v]) => [k, Math.round((v / Math.max(1, this.reps)) * 10) / 10]),
    );
    return {
      reps: this.reps,
      goodReps: this.goodReps,
      holdS: Math.round(this.holdMs / 1000),
      faults,
      topFaults: Object.entries(faults)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, count]) => ({ key, label: this.rule.faultLabels[key] ?? key, count })),
      metrics,
      ...(this.rule.key === "lunge" ? { perSide: { ...this.sides } } : {}),
    };
  }
}
