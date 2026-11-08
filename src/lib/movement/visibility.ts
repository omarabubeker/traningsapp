import { P, type ImageLandmark, type RequiredLandmarks } from "./types";

const inFrame = (p: ImageLandmark) => p.x > -0.02 && p.x < 1.02 && p.y > -0.02 && p.y < 1.02;

/** Syns alla angivna landmärken i bild med tillräcklig säkerhet? */
export function allVisible(image: ImageLandmark[], idx: number[], minVisibility = 0.5) {
  return idx.every((i) => {
    const p = image[i];
    return !!p && inFrame(p) && (p.visibility ?? 1) >= minVisibility;
  });
}

/** Kroppen räknas som synlig om de gemensamma punkterna och minst en hel sida syns. */
export function bodyVisible(image: ImageLandmark[], req: RequiredLandmarks, minVisibility = 0.5) {
  if (req.common && !allVisible(image, req.common, minVisibility)) return false;
  return allVisible(image, req.left, minVisibility) || allVisible(image, req.right, minVisibility);
}

const LEG = {
  left: [P.leftShoulder, P.leftHip, P.leftKnee, P.leftAnkle],
  right: [P.rightShoulder, P.rightHip, P.rightKnee, P.rightAnkle],
};

/** Lägsta synlighet för en sidas axel, höft, knä och fotled (0–1). */
export function sideVisibility(image: ImageLandmark[], side: "left" | "right") {
  return Math.min(...LEG[side].map((i) => (image[i] && inFrame(image[i]) ? (image[i].visibility ?? 1) : 0)));
}

/** Kräver att kroppen varit borta en stund innan vi säger till (undviker flimmer). */
export class VisibilityGate {
  private hiddenSince: number | null = null;
  constructor(private graceMs = 1000) {}
  update(visible: boolean, now: number) {
    if (visible) {
      this.hiddenSince = null;
      return true;
    }
    this.hiddenSince ??= now;
    return now - this.hiddenSince < this.graceMs;
  }
}
