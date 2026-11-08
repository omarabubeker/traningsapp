// One Euro-filter: jämnar ut brus i landmärken utan att släpa efter vid snabba rörelser.
// Casiez m.fl. 2012. Parametrarna är valda för pose-landmärken i meter vid ~20–30 fps.

class LowPass {
  private y: number | null = null;
  filter(x: number, alpha: number) {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  last() {
    return this.y;
  }
}

const alphaFor = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));

export class OneEuro {
  private x = new LowPass();
  private dx = new LowPass();
  private tPrev: number | null = null;
  constructor(private minCutoff = 1.2, private beta = 0.3, private dCutoff = 1) {}

  filter(value: number, tMs: number) {
    const dt = this.tPrev === null ? 1 / 30 : Math.max(1e-3, (tMs - this.tPrev) / 1000);
    this.tPrev = tMs;
    const prev = this.x.last();
    const deriv = prev === null ? 0 : (value - prev) / dt;
    const edx = this.dx.filter(deriv, alphaFor(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    return this.x.filter(value, alphaFor(cutoff, dt));
  }
}

/** Filtrerar alla koordinater i en lista av punkter. */
export class PointFilter {
  private filters: OneEuro[][] = [];
  apply<T extends { x: number; y: number; z: number }>(points: T[], tMs: number): T[] {
    return points.map((p, i) => {
      this.filters[i] ??= [new OneEuro(), new OneEuro(), new OneEuro()];
      const [fx, fy, fz] = this.filters[i];
      return { ...p, x: fx.filter(p.x, tMs), y: fy.filter(p.y, tMs), z: fz.filter(p.z, tMs) };
    });
  }
}
