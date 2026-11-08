import { angle, angleFromVertical, mid } from "../geometry";
import { P, type Cue, type MovementRule, type PoseFrame } from "../types";
import { sideVisibility } from "../visibility";

// Knäböj. Fungerar framifrån, snett framifrån och från sidan. Från sidan mäts den sida
// som syns bäst; knän inåt och höger/vänster-skillnad kräver att båda sidor syns.
// Repfaser via knävinkel med hysteres: under 140° = på väg ner, över 160° = uppe igen.

const DOWN_START = 140;
const TOP = 160;
const DEPTH_OK = 105; // knävinkel i botten; ~90–100° motsvarar ungefär parallellt
const LEAN_MAX = 50; // bålens vinkel från lodlinjen i botten
const VALGUS_RATIO = 0.8; // knäavstånd / fotledsavstånd
const ASYM_MAX = 15;
const MAX_REP_MS = 8000;

type State = {
  phase: "top" | "down";
  started: number;
  minKnee: number;
  maxLean: number;
  minKneeRatio: number;
  maxAsym: number;
  heelLift: number;
};

const fresh = (t = 0): State => ({ phase: "top", started: t, minKnee: 180, maxLean: 0, minKneeRatio: 9, maxAsym: 0, heelLift: 0 });

export const squat: MovementRule<State> = {
  key: "squat",
  name: "Knäböj",
  kind: "reps",
required: {
    left: [P.leftShoulder, P.leftHip, P.leftKnee, P.leftAnkle],
    right: [P.rightShoulder, P.rightHip, P.rightKnee, P.rightAnkle],
  },
  setup: "Ställ telefonen i höfthöjd 2–3 m bort. Snett framifrån (cirka 45°) bedömer flest fel; från sidan går också bra. Hela kroppen ska synas, även fötterna.",
  faultLabels: {
    shallow: "För grunt",
    knees_in: "Knäna faller inåt",
    lean: "För mycket framåtlutning",
    heels_up: "Hälarna lyfter",
    asymmetry: "Ojämn belastning höger/vänster",
  },
  init: () => fresh(),
  ready: (f) => kneeAngles(f).knee > TOP,
  update(f: PoseFrame, s: State) {
    const w = f.world;
    const { kneeL, kneeR, knee, both, best } = kneeAngles(f);
    const lean = angleFromVertical(mid(w[P.leftHip], w[P.rightHip]), mid(w[P.leftShoulder], w[P.rightShoulder]));
    const kneeW = Math.abs(w[P.leftKnee].x - w[P.rightKnee].x);
    const ankleW = Math.abs(w[P.leftAnkle].x - w[P.rightAnkle].x) || 1e-6;
    // Knän inåt går bara att se när båda sidor syns.
    const ratio = both ? kneeW / ankleW : 9;
    // y är nedåt: hälen högre än tårna betyder mindre y. Bara synliga sidor räknas.
    const heelOf = (side: "left" | "right") =>
      side === "left" ? (w[P.leftFoot]?.y ?? 0) - (w[P.leftHeel]?.y ?? 0) : (w[P.rightFoot]?.y ?? 0) - (w[P.rightHeel]?.y ?? 0);
    const heel = both ? Math.max(heelOf("left"), heelOf("right")) : heelOf(best);

    const cues: Cue[] = [];
    if (s.phase === "top") {
      if (knee < DOWN_START) s = { ...fresh(f.t), phase: "down" };
      else return { state: s, cues, phase: "Upp" };
    }

    // På väg ner / i botten / på väg upp
    s = {
      ...s,
      minKnee: Math.min(s.minKnee, knee),
      maxLean: Math.max(s.maxLean, lean),
      minKneeRatio: knee < 125 ? Math.min(s.minKneeRatio, ratio) : s.minKneeRatio,
      maxAsym: knee < 125 && both ? Math.max(s.maxAsym, Math.abs(kneeL - kneeR)) : s.maxAsym,
      heelLift: Math.max(s.heelLift, heel),
    };
    if (knee < 125 && ratio < VALGUS_RATIO) cues.push({ id: "knees_in", text: "Tryck ut knäna", priority: 1 });
    if (lean > LEAN_MAX + 5) cues.push({ id: "lean", text: "Bröstet upp", priority: 1 });
    if (heel > 0.03) cues.push({ id: "heels_up", text: "Tyngden på hälarna", priority: 2 });

    if (f.t - s.started > MAX_REP_MS) return { state: fresh(f.t), cues, phase: "Upp" };

    if (knee > TOP) {
      const faults: string[] = [];
      if (s.minKnee > DEPTH_OK) faults.push("shallow");
      if (s.minKneeRatio < VALGUS_RATIO) faults.push("knees_in");
      if (s.maxLean > LEAN_MAX) faults.push("lean");
      if (s.heelLift > 0.03) faults.push("heels_up");
      if (s.maxAsym > ASYM_MAX) faults.push("asymmetry");
      const done = fresh(f.t);
      if (faults.includes("shallow")) cues.push({ id: "shallow", text: "Gå lite djupare", priority: 2 });
      else if (!faults.length) cues.push({ id: "good", text: "Snyggt!", priority: 3 });
      return {
        state: done,
        cues,
        phase: "Upp",
        rep: {
          good: faults.length === 0,
          faults,
          metrics: { depth: Math.round(s.minKnee), lean: Math.round(s.maxLean), kneeRatio: Math.round(s.minKneeRatio * 100) / 100 },
        },
      };
    }
    return { state: s, cues, phase: knee < s.minKnee + 3 ? "Botten" : "Ner" };
  },
};

/** Knävinklar från den sida som syns bäst (eller snittet om båda syns bra). */
function kneeAngles(f: PoseFrame) {
  const w = f.world;
  const kneeL = angle(w[P.leftHip], w[P.leftKnee], w[P.leftAnkle]);
  const kneeR = angle(w[P.rightHip], w[P.rightKnee], w[P.rightAnkle]);
  const vl = sideVisibility(f.image, "left");
  const vr = sideVisibility(f.image, "right");
  const both = vl >= 0.6 && vr >= 0.6;
  const best: "left" | "right" = vl >= vr ? "left" : "right";
  const knee = both ? (kneeL + kneeR) / 2 : best === "left" ? kneeL : kneeR;
  return { kneeL, kneeR, knee, both, best };
}
