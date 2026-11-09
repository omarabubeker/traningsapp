// Syntetiska kroppar i MediaPipes världskoordinater (meter, höften i origo, y nedåt, +z framåt).
import { P, type ImageLandmark, type PoseFrame, type Vec3 } from "../types";

const deg = (d: number) => (d * Math.PI) / 180;
const THIGH = 0.45, SHIN = 0.45, TORSO = 0.5;

function empty(): Vec3[] {
  return Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
}
function visibleImage(): ImageLandmark[] {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }));
}

type SquatOpts = { kneeAngle: number; lean?: number; kneeInward?: number; heelLift?: number; asym?: number; shoulderX?: number };

/** Knäböj framifrån/snett: lårets vinkel ger knävinkeln (180 = stående). */
export function squatPose({ kneeAngle, lean = 15, kneeInward = 0, heelLift = 0, asym = 0, shoulderX = 0.18 }: SquatOpts): Vec3[] {
  const w = empty();
  for (const [side, sx] of [["l", -1], ["r", 1]] as const) {
    const ka = kneeAngle + (side === "l" ? asym / 2 : -asym / 2);
    const phi = deg(180 - ka); // lårets vinkel från lodlinjen
    const hip = { x: sx * 0.1, y: 0, z: 0 };
    const ankleX = sx * 0.14;
    const knee = { x: sx * 0.14 - sx * kneeInward, y: THIGH * Math.cos(phi), z: THIGH * Math.sin(phi) };
    const ankle = { x: ankleX, y: knee.y + SHIN, z: knee.z };
    const heel = { x: ankleX, y: ankle.y + 0.05 - heelLift, z: ankle.z - 0.05 };
    const foot = { x: ankleX, y: ankle.y + 0.06, z: ankle.z + 0.15 };
    const shoulder = { x: sx * shoulderX, y: -TORSO * Math.cos(deg(lean)), z: TORSO * Math.sin(deg(lean)) };
    if (side === "l") Object.assign(w, { [P.leftHip]: hip, [P.leftKnee]: knee, [P.leftAnkle]: ankle, [P.leftHeel]: heel, [P.leftFoot]: foot, [P.leftShoulder]: shoulder });
    else Object.assign(w, { [P.rightHip]: hip, [P.rightKnee]: knee, [P.rightAnkle]: ankle, [P.rightHeel]: heel, [P.rightFoot]: foot, [P.rightShoulder]: shoulder });
  }
  w[P.nose] = { x: 0, y: -TORSO - 0.15, z: 0.05 };
  return w;
}

/** Utfall: främre ben (front) och bakre ben med givna knävinklar. */
export function lungePose(front: "left" | "right", frontKnee: number, backKnee: number, lean = 5, shoulderX = 0.03): Vec3[] {
  const w = empty();
  const legs = { front: frontKnee, back: backKnee };
  for (const role of ["front", "back"] as const) {
    const left = (role === "front") === (front === "left");
    const sx = left ? -1 : 1;
    const ka = legs[role];
    const dir = role === "front" ? 1 : -1;
    // Främre lår framåt (höftböjning), bakre lår bakåt/lodrätt.
    const thighAngle = role === "front" ? deg(180 - ka) : deg(10);
    const hip = { x: sx * 0.1, y: 0, z: 0 };
    const knee = { x: sx * 0.1, y: THIGH * Math.cos(thighAngle), z: dir * THIGH * Math.sin(thighAngle) };
    const shinAngle = role === "front" ? 0 : deg(180 - ka) + thighAngle;
    const ankle = { x: sx * 0.1, y: knee.y + SHIN * Math.cos(shinAngle), z: knee.z - SHIN * Math.sin(shinAngle) };
    const shoulder = { x: sx * shoulderX, y: -TORSO * Math.cos(deg(lean)), z: TORSO * Math.sin(deg(lean)) };
    if (left) Object.assign(w, { [P.leftHip]: hip, [P.leftKnee]: knee, [P.leftAnkle]: ankle, [P.leftShoulder]: shoulder });
    else Object.assign(w, { [P.rightHip]: hip, [P.rightKnee]: knee, [P.rightAnkle]: ankle, [P.rightShoulder]: shoulder });
  }
  w[P.nose] = { x: 0, y: -TORSO - 0.15, z: 0.05 };
  return w;
}

/** Planka från sidan: kroppen längs z-axeln. hipOffset > 0 = höften sjunker (y nedåt). */
export function plankPose({ hipOffset = 0, tilt = 5, headDrop = 0 } = {}): Vec3[] {
  const w = empty();
  const t = deg(tilt);
  const sh = { x: 0, y: -0.75 * Math.sin(t), z: 0.75 * Math.cos(t) };
  const ank = { x: 0, y: 0.75 * Math.sin(t), z: -0.75 * Math.cos(t) };
  const hip = { x: 0, y: hipOffset, z: 0 };
  for (const [s, h, a] of [[P.leftShoulder, P.leftHip, P.leftAnkle], [P.rightShoulder, P.rightHip, P.rightAnkle]] as const) {
    w[s] = sh; w[h] = hip; w[a] = ank;
  }
  w[P.nose] = { x: 0, y: sh.y + headDrop, z: sh.z + 0.15 };
  return w;
}

export function frame(t: number, world: Vec3[]): PoseFrame {
  return { t, world, image: visibleImage() };
}

/** Sekvens av knävinklar ner till botten och upp igen, 30 fps. */
export function repAngles(bottom: number, steps = 30) {
  const down = Array.from({ length: steps }, (_, i) => 175 - ((175 - bottom) * (i + 1)) / steps);
  return [175, 175, ...down, ...[...down].reverse(), 175, 175];
}

/** Armhävning från sidan: armbågsvinkel styr axelns höjd. Kroppen längs z (huvud mot +z), golvet y = 0,6. */
export function pushupPose({ elbow, hipOffset = 0, headDrop = 0 }: { elbow: number; hipOffset?: number; headDrop?: number }): Vec3[] {
  const w = empty();
  const FLOOR = 0.6;
  const phi = deg(180 - elbow);
  for (const [sx, s, e, wr, h, a] of [
    [-0.15, P.leftShoulder, P.leftElbow, P.leftWrist, P.leftHip, P.leftAnkle],
    [0.15, P.rightShoulder, P.rightElbow, P.rightWrist, P.rightHip, P.rightAnkle],
  ] as const) {
    const wrist = { x: sx, y: FLOOR, z: 0 };
    const el = { x: sx, y: FLOOR - 0.27, z: 0 };
    const sh = { x: sx, y: el.y - 0.3 * Math.cos(phi), z: 0.3 * Math.sin(phi) };
    const ank = { x: sx * 0.6, y: FLOOR - 0.05, z: sh.z - 1.4 };
    const hip = { x: sx * 0.7, y: (sh.y + ank.y) / 2 + hipOffset, z: (sh.z + ank.z) / 2 };
    w[s] = sh; w[e] = el; w[wr] = wrist; w[h] = hip; w[a] = ank;
  }
  const sh = w[P.leftShoulder];
  w[P.nose] = { x: 0, y: sh.y + headDrop, z: sh.z + 0.2 };
  return w;
}

/** Marklyft från sidan: bållutning (från lodlinjen) och lårets vinkel (knäböjning). Höftvinkel = 180 − (bål + lår). */
export function deadliftPose({ lean, thigh }: { lean: number; thigh: number }): Vec3[] {
  const w = empty();
  for (const [sx, s, h, k, a] of [
    [-1, P.leftShoulder, P.leftHip, P.leftKnee, P.leftAnkle],
    [1, P.rightShoulder, P.rightHip, P.rightKnee, P.rightAnkle],
  ] as const) {
    const hip = { x: sx * 0.1, y: 0, z: 0 };
    const knee = { x: sx * 0.1, y: THIGH * Math.cos(deg(thigh)), z: THIGH * Math.sin(deg(thigh)) };
    const ankle = { x: sx * 0.1, y: knee.y + SHIN, z: knee.z };
    const sh = { x: sx * 0.03, y: -TORSO * Math.cos(deg(lean)), z: TORSO * Math.sin(deg(lean)) };
    w[s] = sh; w[h] = hip; w[k] = knee; w[a] = ankle;
  }
  w[P.nose] = { x: 0, y: w[P.leftShoulder].y - 0.15, z: w[P.leftShoulder].z + 0.1 };
  return w;
}

/** Linjär interpolation av en parameter genom flera hållpunkter, `perSegment` rutor mellan varje. */
export function path(points: number[], perSegment = 30): number[] {
  const out: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    for (let k = 0; k < perSegment; k++) out.push(points[i] + ((points[i + 1] - points[i]) * k) / perSegment);
  }
  out.push(points.at(-1)!);
  return out;
}
