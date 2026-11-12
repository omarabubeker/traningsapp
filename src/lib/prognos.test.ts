import { describe, expect, it } from "vitest";
import { bestSegment, effortsOf, formSeries, formState, predict, predictionTrend, sessionLoad } from "./prognos";

const sp = (paces: number[]) => paces.map((p, i) => ({ km: i + 1, dist_m: 1000, time_s: p }));

describe("prognos", () => {
  it("snabbaste sammanhängande sträcka", () => {
    expect(bestSegment(sp([360, 300, 300, 300, 300, 300, 400]), 5)).toBe(1500);
    expect(bestSegment(sp([300, 300]), 5)).toBeNull();
  });

  it("prestationer ur ett pass", () => {
    const e = effortsOf({ day: "2026-11-01", km: 12, timeS: 4000, splits: sp([340, 330, 300, 300, 300, 300, 300, 330, 330, 330, 340, 350]) });
    expect(e.map((x) => x.label)).toEqual(["pass", "5 km i passet", "10 km i passet"]);
    expect(e[1].timeS).toBe(1500);
    expect(effortsOf({ day: "2026-11-01", km: 2, timeS: 600 })).toEqual([]);
    expect(effortsOf({ day: "2026-11-01", km: 10, timeS: 1000 })).toEqual([]); // orimligt snabbt
  });

  it("bästa omräknade tid inom fönstret", () => {
    const efforts = [
      { day: "2026-09-01", km: 5, timeS: 1400, label: "pass" }, // för gammalt
      { day: "2026-11-01", km: 5, timeS: 1500, label: "pass" },
      { day: "2026-11-05", km: 10, timeS: 3300, label: "pass" },
    ];
    const p = predict(efforts, 10, "2026-11-12")!;
    expect(p.from.km).toBe(5);
    expect(Math.round(p.timeS)).toBe(3127); // 25:00 på 5 km → 52:07 på 10 km
    expect(predict(efforts, 10, "2026-08-01")).toBeNull();
    expect(predictionTrend(efforts, 10, "2026-11-12", 4).length).toBeGreaterThan(0);
  });
});

describe("form", () => {
  const hr = { rest: 50, max: 190 };
  it("belastning: intervals siffra först, annars puls", () => {
    expect(sessionLoad({ day: "d", minutes: 60, avgHr: 150, load: 77 }, hr)).toBe(77);
    const threshold = sessionLoad({ day: "d", minutes: 60, avgHr: 50 + 0.85 * 140, load: null }, hr);
    expect(Math.round(threshold)).toBe(100);
    expect(sessionLoad({ day: "d", minutes: 30, avgHr: 130, load: null }, hr)).toBeLessThan(threshold / 2);
  });

  it("kondition växer långsamt, tröttheten snabbt", () => {
    const sessions = Array.from({ length: 28 }, (_, i) => ({ day: `2026-10-${String(i + 1).padStart(2, "0")}`, minutes: 60, avgHr: 160, load: null }));
    const s = formSeries(sessions, hr, "2026-10-01", "2026-10-29");
    const last = s.at(-1)!;
    expect(last.fatigue).toBeGreaterThan(last.fitness);
    expect(last.form).toBeLessThan(0);
    expect(formState(last.form).key).not.toBe("fresh");
    expect(formState(8).label).toBe("Utvilad");
    expect(formState(-40).key).toBe("high");
  });
});
