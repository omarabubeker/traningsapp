import { describe, expect, it } from "vitest";
import { parsePace, plannedWorkout, simpleSteps, workoutHash } from "./watchWorkout";

const item = (target: Record<string, unknown>, kind = "run") => ({ date: "2026-11-14", kind, title: "Lugn distans", description: "Samtalstempo.", target });

describe("pass till klockan", () => {
  it("läser tempo ur fritext", () => {
    expect(parsePace("lugnt, Z2, ca 6:20/km")).toEqual({ lo: 370, hi: 390 });
    expect(parsePace("tempo 5:10–5:20/km")).toEqual({ lo: 310, hi: 320 });
    expect(parsePace("lugnt")).toBeNull();
  });

  it("enkelt pass med tempo, zon eller bara längd", () => {
    expect(simpleSteps({ distance_km: 8, intensity: "ca 6:20/km" })).toBe("- 8km 6:10-6:30/km Pace");
    expect(simpleSteps({ duration_min: 45, intensity: "lugnt i Z2" })).toBe("- 45m Z2 HR");
    expect(simpleSteps({ distance_km: 5 })).toBe("- 5km");
    expect(simpleSteps({})).toBeNull();
  });

  it("använder coachens steg när de finns", () => {
    const w = plannedWorkout(item({ distance_km: 8, intensity: "6 × 800 m", workout: "Uppvärmning\n- 10m Z2 HR\n\n6x\n- 800mtr 4:50-5:00/km Pace\n- 2m Z1 HR" }))!;
    expect(w.description).toBe("Samtalstempo.\n6 × 800 m\n\nUppvärmning\n- 10m Z2 HR\n\n6x\n- 800mtr 4:50-5:00/km Pace\n- 2m Z1 HR");
    expect(w.name).toBe("Lugn distans");
  });

  it("bara löppass skickas", () => {
    expect(plannedWorkout(item({}, "gym"))).toBeNull();
    expect(plannedWorkout(item({}, "rest"))).toBeNull();
  });

  it("fingeravtrycket ändras när datumet ändras", () => {
    const a = plannedWorkout(item({ distance_km: 8 }))!;
    expect(workoutHash(a)).toBe(workoutHash({ ...a }));
    expect(workoutHash(a)).not.toBe(workoutHash({ ...a, date: "2026-11-15" }));
  });
});
