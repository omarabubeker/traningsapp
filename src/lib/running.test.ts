import { describe, expect, it } from "vitest";
import { computeSplits, formatPace, haversine, simplifyRoute, withDistance } from "./running";
import { appleDate, parseGpx } from "./appleHealth";

describe("computeSplits", () => {
  it("delar upp ett jämnt pass i hela km plus rest", () => {
    // 2,5 km i 5:00/km → punkt var 10:e sekund med 33,33 m
    const pts = Array.from({ length: 76 }, (_, i) => ({ t: i * 10, d: Math.min(i * (1000 / 30), 2500) }));
    const s = computeSplits(pts);
    expect(s.map((x) => x.km)).toEqual([1, 2, 3]);
    expect(s[0].pace_s).toBeCloseTo(300, 0);
    expect(s[2].dist_m).toBe(500);
  });

  it("hoppar över en sista bit kortare än 100 m", () => {
    const pts = Array.from({ length: 11 }, (_, i) => ({ t: i * 30, d: i * 105 }));
    expect(computeSplits(pts).map((x) => x.km)).toEqual([1]);
  });

  it("räknar distans från koordinater", () => {
    const pts = withDistance([
      { t: 0, lat: 59.0, lng: 18.0 },
      { t: 60, lat: 59.001, lng: 18.0 },
    ]);
    expect(pts[1].d).toBeCloseTo(111.2, 0);
    expect(haversine([59, 18], [59.001, 18])).toBeCloseTo(111.2, 0);
  });
});

describe("hjälpfunktioner", () => {
  it("formaterar tempo", () => {
    expect(formatPace(373.3)).toBe("6:13");
    expect(formatPace(null)).toBe("–");
  });
  it("förenklar rutt till max antal punkter", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => ({ t: i, lat: 59 + i * 1e-5, lng: 18 }));
    const r = simplifyRoute(pts, 100);
    expect(r).toHaveLength(100);
    expect(r[0]).toEqual([59, 18]);
  });
  it("tolkar Apples datumformat", () => {
    expect(appleDate("2026-11-05 19:16:37 +0100")).toBe("2026-11-05T18:16:37.000Z");
  });
  it("läser GPX-punkter", () => {
    const gpx = `<gpx><trk><trkseg>
      <trkpt lon="18.0" lat="59.0"><ele>10</ele><time>2026-10-03T07:15:53Z</time></trkpt>
      <trkpt lon="18.0" lat="59.001"><ele>12</ele><time>2026-10-03T07:16:23Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const pts = parseGpx(gpx);
    expect(pts).toHaveLength(2);
    expect(pts[1]).toMatchObject({ t: 30, lat: 59.001, ele: 12 });
  });
});
