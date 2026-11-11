import { describe, expect, it } from "vitest";
import { monotonePath } from "./svgPath";

describe("monotonePath", () => {
  it("kontrollpunkterna håller sig inom varje segments värden (ingen översläng)", () => {
    const pts: [number, number][] = [[0, 10], [10, 50], [20, 45], [30, 90], [40, 90], [50, 20]];
    const nums = monotonePath(pts).replace(/[MC]/g, " ").trim().split(/[\s,]+/).map(Number);
    const ys = nums.filter((_, i) => i % 2 === 1).slice(1); // hoppa över startpunkten
    for (let seg = 0; seg < pts.length - 1; seg++) {
      const [lo, hi] = [Math.min(pts[seg][1], pts[seg + 1][1]), Math.max(pts[seg][1], pts[seg + 1][1])];
      for (const y of ys.slice(seg * 3, seg * 3 + 3)) {
        expect(y).toBeGreaterThanOrEqual(lo - 0.05);
        expect(y).toBeLessThanOrEqual(hi + 0.05);
      }
    }
  });
});
