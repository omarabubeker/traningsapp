import type { ImageLandmark } from "./types";

/** Syns alla nödvändiga landmärken i bild med tillräcklig säkerhet? */
export function bodyVisible(image: ImageLandmark[], required: number[], minVisibility = 0.5) {
  return required.every((i) => {
    const p = image[i];
    if (!p) return false;
    const inFrame = p.x > -0.02 && p.x < 1.02 && p.y > -0.02 && p.y < 1.02;
    return inFrame && (p.visibility ?? 1) >= minVisibility;
  });
}

/** Kräver att kroppen varit borta en stund innan vi säger till (undviker flimmer). */
export class VisibilityGate {
  private hiddenSince: number | null = null;
  constructor(private graceMs = 600) {}
  update(visible: boolean, now: number) {
    if (visible) {
      this.hiddenSince = null;
      return true;
    }
    this.hiddenSince ??= now;
    return now - this.hiddenSince < this.graceMs;
  }
}
