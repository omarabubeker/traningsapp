import { describe, expect, it } from "vitest";
import { matchWatchToGym } from "./watchMerge";

describe("klockpass och gympass", () => {
  const session = { id: "g1", started_at: "2026-11-09T06:52:00Z", ended_at: "2026-11-09T07:50:00Z" };
  it("kopplar ett överlappande styrkepass från klockan", () => {
    const m = matchWatchToGym([{ id: "a1", sport_type: "Strength", start_time: "2026-11-09T06:55:00Z", moving_time_s: 3000 }], [session]);
    expect(m.get("a1")).toBe("g1");
  });
  it("kopplar inte löppass eller pass en annan tid", () => {
    const m = matchWatchToGym(
      [
        { id: "run", sport_type: "Run", start_time: "2026-11-09T06:55:00Z", moving_time_s: 1800 },
        { id: "sent", sport_type: "Strength", start_time: "2026-11-09T15:00:00Z", moving_time_s: 1800 },
      ],
      [session],
    );
    expect(m.size).toBe(0);
  });
  it("hanterar pågående pass utan sluttid", () => {
    const m = matchWatchToGym([{ id: "a1", sport_type: "Strength", start_time: "2026-11-09T07:30:00Z", moving_time_s: 600 }], [{ ...session, ended_at: null }]);
    expect(m.get("a1")).toBe("g1");
  });
});
