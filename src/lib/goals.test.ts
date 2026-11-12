import { describe, expect, it } from "vitest";
import { matchWeek, type DoneSession } from "./coach/plan";
import { milestones, personalRecords, streak, weekRings, type RunLike } from "./goals";

const W = "2026-11-09"; // måndag
const item = (id: string, date: string, kind: "run" | "gym" | "rest" | "other", km?: number) => ({ id, date, kind, target: km ? { distance_km: km } : null });

describe("matchWeek (flexibla dagar)", () => {
  it("ett pass som flyttats till en annan dag samma vecka räknas som gjort", () => {
    const items = [item("a", "2026-11-10", "run", 8), item("b", "2026-11-12", "gym")];
    const sessions: DoneSession[] = [{ kind: "run", day: "2026-11-11", km: 8 }, { kind: "gym", day: "2026-11-13" }];
    const m = matchWeek(items, sessions, W, "2026-11-14");
    expect(m.get("a")).toEqual({ status: "done", doneDay: "2026-11-11" });
    expect(m.get("b")).toEqual({ status: "done", doneDay: "2026-11-13" });
  });
  it("långpasset matchas mot det längsta passet oavsett dag", () => {
    const items = [item("lugn", "2026-11-14", "run", 6), item("lang", "2026-11-15", "run", 20)];
    const sessions: DoneSession[] = [{ kind: "run", day: "2026-11-14", km: 20 }, { kind: "run", day: "2026-11-15", km: 6 }];
    const m = matchWeek(items, sessions, W, "2026-11-16");
    // samma-dag först: lugn ↔ 20 km (lör), lång ↔ 6 km (sön) – båda gjorda
    expect(m.get("lugn")?.status).toBe("done");
    expect(m.get("lang")?.status).toBe("done");
  });
  it("passerad dag räknas som kvar i veckan tills veckan är slut, sedan missad", () => {
    const items = [item("a", "2026-11-10", "run", 5)];
    expect(matchWeek(items, [], W, "2026-11-12").get("a")?.status).toBe("pending");
    expect(matchWeek(items, [], W, "2026-11-16").get("a")?.status).toBe("missed");
  });
  it("ett pass räknas bara mot ett planerat pass, och pass från andra veckor räknas inte", () => {
    const items = [item("a", "2026-11-10", "run"), item("b", "2026-11-11", "run")];
    const m = matchWeek(items, [{ kind: "run", day: "2026-11-10", km: 5 }, { kind: "run", day: "2026-11-17", km: 5 }], W, "2026-11-20");
    expect(m.get("a")?.status).toBe("done");
    expect(m.get("b")?.status).toBe("missed");
  });
  it("vila räknas aldrig som missad", () => {
    expect(matchWeek([item("r", "2026-11-10", "rest")], [], W, "2026-11-20").get("r")?.status).toBe("rest");
  });
});

describe("veckoringar och svit", () => {
  it("ringarna räknar km, gympass och planens andel", () => {
    const items = [
      { kind: "run" as const, target: { distance_km: 10 }, status: "done" as const },
      { kind: "run" as const, target: { distance_km: 20 }, status: "pending" as const },
      { kind: "gym" as const, target: null, status: "done" as const },
      { kind: "rest" as const, target: null, status: "rest" as const },
    ];
    const r = weekRings(items, [{ kind: "run", day: "2026-11-10", km: 11.2 }, { kind: "gym", day: "2026-11-11" }, { kind: "run", day: "2026-11-17", km: 9 }], W);
    expect(r).toEqual({ km: { done: 11.2, target: 30 }, gym: { done: 1, target: 1 }, plan: { done: 2, total: 3 } });
  });
  it("sviten hoppar över veckor utan plan och en pågående vecka som inte är klar", () => {
    const weeks = [
      { weekStart: "2026-10-19", done: 4, total: 5 },
      { weekStart: "2026-10-26", done: 2, total: 5 }, // bryter
      { weekStart: "2026-11-02", done: 5, total: 5 },
      { weekStart: "2026-11-09", done: 0, total: 0 }, // ingen plan
      { weekStart: "2026-11-16", done: 5, total: 5 },
      { weekStart: "2026-11-23", done: 1, total: 5 }, // pågår
    ];
    expect(streak(weeks, "2026-11-23")).toEqual({ current: 2, best: 2 });
  });
});

const run = (day: string, km: number, pace: number | null = 330, reliable = true): RunLike => ({ id: day, day, km, pace, reliable });

describe("rekord och milstolpar", () => {
  it("hittar rekord, föregående rekord och markerar nya", () => {
    const recs = personalRecords([run("2026-10-01", 10, 320), run("2026-11-08", 12, 310), run("2026-11-09", 5, 290, false)], [], "2026-11-10");
    const longest = recs.find((r) => r.key === "longest")!;
    expect(longest.value).toBe("12 km");
    expect(longest.previous).toBe("10 km");
    expect(longest.isNew).toBe(true);
    // opålitligt tempo (löpband utan rättning) räknas inte
    expect(recs.find((r) => r.key === "pace5")!.value).toBe("5:10/km");
  });
  it("gymrekord via uppskattat 1RM", () => {
    const recs = personalRecords([], [
      { exercise: "Knäböj", day: "2026-11-01", weight: 100, reps: 5, warmup: false, bodyweight: false },
      { exercise: "Knäböj", day: "2026-11-08", weight: 110, reps: 1, warmup: false, bodyweight: false },
    ], "2026-11-30");
    expect(recs[0]).toMatchObject({ label: "Knäböj", value: "100 kg × 5", isNew: false });
  });
  it("milstolpar räknas från startdatum", () => {
    const mara = { kind: "race" as const, distance_km: 42.195, target_time_s: 14399, start_date: "2026-11-02" };
    const ms = milestones([run("2026-10-01", 21.5, 300), run("2026-11-15", 16, 340), run("2026-11-22", 21.2, 320)], mara);
    // samma milstolpar som tidigare för maran (nycklarna används för firanden)
    expect(ms.map((m) => m.key)).toEqual(["long15", "week40", "long20", "half", "long25", "week50", "three40", "long30", "mp30", "long32"]);
    expect(ms.find((m) => m.key === "half")!.label).toBe("Halvmara under 1:55");
    expect(ms.find((m) => m.key === "long15")!.day).toBe("2026-11-15");
    expect(ms.find((m) => m.key === "half")!.day).toBe("2026-11-22");
    expect(ms.find((m) => m.key === "long25")!.day).toBeNull();
  });
});

describe("milstolpar för andra mål", () => {
  it("skalar efter distansen (10 km under 50 min)", () => {
    const ms = milestones([run("2026-12-01", 5, 290)], { kind: "race", distance_km: 10, target_time_s: 3000, start_date: "2026-11-30" });
    expect(ms.map((m) => m.label)).toContain("5 km under 23:58");
    expect(ms.map((m) => m.label)).toContain("8 km i måltempo");
    expect(ms[0]).toMatchObject({ key: "long5", day: "2026-12-01" });
  });
  it("allmänt mål räknar pass och kilometer", () => {
    const days = Array.from({ length: 12 }, (_, i) => `2026-12-${String(i + 1).padStart(2, "0")}`);
    const ms = milestones([], { kind: "general", distance_km: null, target_time_s: null, start_date: "2026-12-01" }, days);
    expect(ms.find((m) => m.key === "pass10")!.day).toBe("2026-12-10");
    expect(ms.find((m) => m.key === "pass25")!.day).toBeNull();
  });
  it("styrkemål följer övningens uppskattade 1RM mot målvikten", () => {
    const set = (day: string, weight: number, reps = 5) => ({ exercise: "Knäböj", day, weight, reps, warmup: false, bodyweight: false });
    const sets = [set("2026-10-20", 80), set("2026-11-05", 85), set("2026-11-12", 95), set("2026-11-20", 100, 3)];
    const ms = milestones([], { kind: "general", focus: "strength", exercise: "Knäböj", target_kg: 110, distance_km: null, target_time_s: null, start_date: "2026-11-01" }, [], { days: ["2026-11-05", "2026-11-12", "2026-11-20"], sets });
    // utgångsläge 80×5 ≈ 93,3 kg → rekord 2026-11-05 (85×5 ≈ 99), halvvägs ≈ 101,7 kg → 95×5 ≈ 110,8 når både halvvägs och målet
    expect(ms.find((m) => m.key === "pr")!.day).toBe("2026-11-05");
    expect(ms.find((m) => m.key === "half")!.day).toBe("2026-11-12");
    expect(ms.find((m) => m.key === "target")!).toMatchObject({ day: "2026-11-12", badge: "110" });
    expect(ms.find((m) => m.key === "gym10")!.day).toBeNull();
  });
});

import { daysTo, formatTime, parseTime, riegel } from "./goalDef";
describe("målhjälp", () => {
  it("tolkar och formaterar tider", () => {
    expect(parseTime("3:59:59")).toBe(14399);
    expect(parseTime("3:45")).toBe(13500);
    expect(parseTime("52:30")).toBe(3150);
    expect(formatTime(14399)).toBe("3:59:59");
    expect(formatTime(1445)).toBe("24:05");
  });
  it("Riegel och dagar kvar", () => {
    expect(Math.round(riegel(14399, 42.195, 21.0975) / 60)).toBe(115);
    expect(daysTo({ race_date: "2027-05-29" }, "2027-05-27")).toBe(2);
  });
});
