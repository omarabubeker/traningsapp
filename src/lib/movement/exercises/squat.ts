import { angle, angleFromVertical, mid } from "../geometry";
import { P, type Cue, type MovementRule, type PoseFrame } from "../types";
import { sideVisibility } from "../visibility";

// Knäböj. Fungerar framifrån, snett framifrån och från sidan.
//
// Djup mäts på två sätt och det som visar mest böjning gäller:
//  1. Knävinkel i 3D (bra från sidan och snett framifrån).
//  2. Höftens höjd över fotlederna jämfört med stående läge (bra rakt framifrån,
//     där MediaPipes djupled är osäker och knävinkeln ser för rak ut).
// Stående läge och fotens normala lutning kalibreras medan personen står still.

const DOWN_KNEE = 140;
const TOP_KNEE = 158;
const DOWN_DROP = 0.85; // höft–fotled-höjd / stående
const TOP_DROP = 0.94;
const DEPTH_KNEE = 105;
const DEPTH_DROP = 0.66;
const LEAN_MAX = 50;
const VALGUS_RATIO = 0.8;
const ASYM_MAX = 15;
const HEEL_LIFT = 0.035; // m över fotens egen nivå i stående
const MAX_REP_MS = 8000;

type State = {
  phase: "top" | "down";
  started: number;
  baseHeight: number | null; // höft→fotled i lodled när man står
  baseHeel: number | null; // tå–häl-skillnad när man står (personlig nolla)
  minKnee: number;
  minDrop: number;
  maxLean: number;
  minKneeRatio: number;
  maxAsym: number;
  heelLift: number;
};

const fresh = (t: number, keep?: State): State => ({
  phase: "top",
  started: t,
  baseHeight: keep?.baseHeight ?? null,
  baseHeel: keep?.baseHeel ?? null,
  minKnee: 180,
  minDrop: 1,
  maxLean: 0,
  minKneeRatio: 9,
  maxAsym: 0,
  heelLift: 0,
});

const ema = (prev: number | null, x: number, a = 0.1) => (prev === null ? x : prev + a * (x - prev));

export const squat: MovementRule<State> = {
  key: "squat",
  name: "Knäböj",
  kind: "reps",
  required: {
    left: [P.leftShoulder, P.leftHip, P.leftKnee, P.leftAnkle],
    right: [P.rightShoulder, P.rightHip, P.rightKnee, P.rightAnkle],
  },
  setup: "Ställ telefonen i höfthöjd 2–3 m bort. Snett framifrån (cirka 45°) bedömer flest fel; rakt framifrån och från sidan går också bra. Hela kroppen ska synas, även fötterna.",
  faultLabels: {
    shallow: "För grunt",
    knees_in: "Knäna faller inåt",
    lean: "För mycket framåtlutning",
    heels_up: "Hälarna lyfter",
    asymmetry: "Ojämn belastning höger/vänster",
  },
  init: () => fresh(0),
  ready: (f) => measure(f).knee > TOP_KNEE,
  update(f: PoseFrame, s: State) {
    const m = measure(f);
    const cues: Cue[] = [];

    if (s.phase === "top") {
      // Kalibrera stående läge medan personen står rak.
      if (m.knee > TOP_KNEE && (s.baseHeight === null || m.height > s.baseHeight * 0.9)) {
        s = { ...s, baseHeight: ema(s.baseHeight, m.height), baseHeel: ema(s.baseHeel, m.heel) };
      }
      const drop = s.baseHeight ? m.height / s.baseHeight : 1;
      if (m.knee < DOWN_KNEE || drop < DOWN_DROP) s = { ...fresh(f.t, s), phase: "down" };
      else return { state: s, cues, phase: "Upp" };
    }

    const drop = s.baseHeight ? m.height / s.baseHeight : 1;
    const deep = m.knee < 125 || drop < 0.75;
    const heelLift = s.baseHeel === null ? 0 : m.heel - s.baseHeel;
    s = {
      ...s,
      minKnee: Math.min(s.minKnee, m.knee),
      minDrop: Math.min(s.minDrop, drop),
      maxLean: Math.max(s.maxLean, m.lean),
      minKneeRatio: deep ? Math.min(s.minKneeRatio, m.ratio) : s.minKneeRatio,
      maxAsym: deep && m.both ? Math.max(s.maxAsym, m.asym) : s.maxAsym,
      heelLift: Math.max(s.heelLift, heelLift),
    };
    if (deep && m.ratio < VALGUS_RATIO) cues.push({ id: "knees_in", text: "Tryck ut knäna", priority: 1 });
    if (m.lean > LEAN_MAX + 5) cues.push({ id: "lean", text: "Bröstet upp", priority: 1 });
    if (heelLift > HEEL_LIFT) cues.push({ id: "heels_up", text: "Tyngden på hälarna", priority: 2 });

    if (f.t - s.started > MAX_REP_MS) return { state: fresh(f.t, s), cues, phase: "Upp" };

    if (m.knee > TOP_KNEE && drop > TOP_DROP) {
      const faults: string[] = [];
      if (s.minKnee > DEPTH_KNEE && s.minDrop > DEPTH_DROP) faults.push("shallow");
      if (s.minKneeRatio < VALGUS_RATIO) faults.push("knees_in");
      if (s.maxLean > LEAN_MAX) faults.push("lean");
      if (s.heelLift > HEEL_LIFT) faults.push("heels_up");
      if (s.maxAsym > ASYM_MAX) faults.push("asymmetry");
      if (faults.includes("shallow")) cues.push({ id: "shallow", text: "Gå lite djupare", priority: 2 });
      else if (!faults.length) cues.push({ id: "good", text: "Snyggt!", priority: 3 });
      return {
        state: fresh(f.t, s),
        cues,
        phase: "Upp",
        rep: {
          good: faults.length === 0,
          faults,
          metrics: {
            depth: Math.round(s.minKnee),
            drop: Math.round(s.minDrop * 100) / 100,
            lean: Math.round(s.maxLean),
            ...(s.minKneeRatio < 9 ? { kneeRatio: Math.round(s.minKneeRatio * 100) / 100 } : {}),
          },
        },
      };
    }
    return { state: s, cues, phase: "Ner" };
  },
};

/** Mått för en ruta, från den sida som syns bäst (eller båda om båda syns bra). */
function measure(f: PoseFrame) {
  const w = f.world;
  const kneeL = angle(w[P.leftHip], w[P.leftKnee], w[P.leftAnkle]);
  const kneeR = angle(w[P.rightHip], w[P.rightKnee], w[P.rightAnkle]);
  const vl = sideVisibility(f.image, "left");
  const vr = sideVisibility(f.image, "right");
  const both = vl >= 0.6 && vr >= 0.6;
  const best: "left" | "right" = vl >= vr ? "left" : "right";
  const pick = <T,>(l: T, r: T) => (best === "left" ? l : r);
  const knee = both ? (kneeL + kneeR) / 2 : pick(kneeL, kneeR);
  // y är nedåt i MediaPipes värld: fotleden ligger under höften → positiv höjd.
  const hL = w[P.leftAnkle].y - w[P.leftHip].y;
  const hR = w[P.rightAnkle].y - w[P.rightHip].y;
  const height = both ? (hL + hR) / 2 : pick(hL, hR);
  const heelL = (w[P.leftFoot]?.y ?? 0) - (w[P.leftHeel]?.y ?? 0);
  const heelR = (w[P.rightFoot]?.y ?? 0) - (w[P.rightHeel]?.y ?? 0);
  const heel = both ? Math.max(heelL, heelR) : pick(heelL, heelR);
  const lean = angleFromVertical(mid(w[P.leftHip], w[P.rightHip]), mid(w[P.leftShoulder], w[P.rightShoulder]));
  const kneeW = Math.abs(w[P.leftKnee].x - w[P.rightKnee].x);
  const ankleW = Math.abs(w[P.leftAnkle].x - w[P.rightAnkle].x) || 1e-6;
  return { knee, height, heel, lean, both, asym: Math.abs(kneeL - kneeR), ratio: both ? kneeW / ankleW : 9 };
}
