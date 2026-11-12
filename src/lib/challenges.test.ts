import { describe, expect, it } from "vitest";
import { challengeState, daysLeft, formatAmount, journeyPosition, liftComparison } from "./challenges";

describe("challenger", () => {
  it("resa: senast passerade och nästa stopp", () => {
    const p = journeyPosition("sthlm-gbg", 180)!;
    expect(p.passed).toBe("Norrköping");
    expect(p.next?.name).toBe("Linköping");
    expect(p.kmToNext).toBe(25);
    expect(journeyPosition("sthlm-gbg", 10)!.passed).toBe("Stockholm");
    expect(journeyPosition("sthlm-gbg", 500)!.next).toBeNull();
    expect(journeyPosition(null, 100)).toBeNull();
  });

  it("lyft: största saken man klarat", () => {
    expect(liftComparison(300)).toBeNull();
    expect(liftComparison(1600)).toBe("en bil");
    expect(liftComparison(13000)).toBe("en stadsbuss");
    expect(liftComparison(320000)).toBe("2 blåvalar");
  });

  it("format", () => {
    expect(formatAmount("kg", 12500)).toEqual({ value: "12,5", unit: "ton" });
    expect(formatAmount("kg", 800)).toEqual({ value: "800", unit: "kg" });
    expect(formatAmount("km", 12.34)).toEqual({ value: "12,3", unit: "km" });
    expect(formatAmount("sessions", 7)).toEqual({ value: "7", unit: "pass" });
  });

  it("datum", () => {
    const c = { start_date: "2026-12-01", end_date: "2026-12-31" };
    expect(challengeState(c, "2026-11-20")).toBe("upcoming");
    expect(challengeState(c, "2026-12-31")).toBe("active");
    expect(challengeState(c, "2027-01-01")).toBe("ended");
    expect(daysLeft(c, "2026-12-29")).toBe(2);
  });
});
