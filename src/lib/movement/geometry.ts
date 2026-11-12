import type { Vec3 } from "./types";

export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const len = (a: Vec3) => Math.sqrt(dot(a, a));
export const mid = (a: Vec3, b: Vec3): Vec3 => scale(add(a, b), 0.5);
export const dist = (a: Vec3, b: Vec3) => len(sub(a, b));

const DEG = 180 / Math.PI;

/** Vinkel i punkten b (grader) mellan a–b–c, i 3D. */
export function angle(a: Vec3, b: Vec3, c: Vec3) {
  const u = sub(a, b), v = sub(c, b);
  const d = len(u) * len(v);
  if (!d) return 180;
  return Math.acos(Math.max(-1, Math.min(1, dot(u, v) / d))) * DEG;
}

/** Vinkel mellan vektorn from→to och lodlinjen (0 = rakt upp/ner). MediaPipe-världen har y nedåt. */
export function angleFromVertical(from: Vec3, to: Vec3) {
  const v = sub(to, from);
  const l = len(v);
  if (!l) return 0;
  return Math.acos(Math.min(1, Math.abs(v.y) / l)) * DEG;
}

/** Horisontellt avstånd (x–z-planet). */
export function horizontalDist(a: Vec3, b: Vec3) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * Kroppslinjen i planka/armhävning: vinkeln axel–höft–fotled (180° = helt rak) och åt vilket
 * håll höften avviker (sag = höften under linjen, pike = över). Kalibrerat mot inspelningar:
 * rak kropp mäts som 167–173° från sidan, uppskjuten höft 105–153°.
 */
export function bodyLine(sh: Vec3, hip: Vec3, ank: Vec3) {
  const body = sub(ank, sh);
  const t = Math.max(0, Math.min(1, ((hip.x - sh.x) * body.x + (hip.z - sh.z) * body.z) / (body.x ** 2 + body.z ** 2 || 1e-6)));
  const below = hip.y - (sh.y + t * body.y) > 0; // y nedåt
  return { hipAngle: angle(sh, hip, ank), dir: below ? ("sag" as const) : ("pike" as const) };
}
