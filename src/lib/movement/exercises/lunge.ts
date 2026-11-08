import { angle, angleFromVertical, mid } from "../geometry";
import { P, type Cue, type MovementRule, type PoseFrame } from "../types";

// Utfallssteg (framåt/bakåt eller på stället). Rekommenderad vinkel: snett framifrån eller från sidan.
// Främre ben = det med störst höftböjning i botten. Reps räknas per ben.

const DOWN_START = 140;
const TOP = 160;
const FRONT_OK = 110; // främre knävinkel i botten
const BACK_OK = 125; // bakre knä ska böjas ordentligt
const LEAN_MAX = 25;
const VALGUS_MAX = 0.08; // m knä utanför linjen höft–fotled i sidled
const MAX_REP_MS = 8000;

type Side = "left" | "right";
type State = {
  phase: "top" | "down";
  started: number;
  minFront: number;
  minBack: number;
  maxLean: number;
  maxValgus: number;
  front: Side | null;
};

const fresh = (t = 0): State => ({ phase: "top", started: t, minFront: 180, minBack: 180, maxLean: 0, maxValgus: 0, front: null });

export const lunge: MovementRule<State> = {
  key: "lunge",
  name: "Utfallssteg",
  kind: "reps",
  required: [P.leftShoulder, P.rightShoulder, P.leftHip, P.rightHip, P.leftKnee, P.rightKnee, P.leftAnkle, P.rightAnkle],
  setup: "Ställ telefonen i höfthöjd 2–3 m bort, snett framifrån eller från sidan. Hela kroppen ska synas genom hela steget.",
  faultLabels: {
    shallow: "För grunt i främre benet",
    back_knee: "Bakre knät går inte ner",
    knee_in: "Främre knät faller inåt",
    lean: "Bålen lutar för mycket",
  },
  init: () => fresh(),
  update(f: PoseFrame, s: State) {
    const w = f.world;
    const kneeL = angle(w[P.leftHip], w[P.leftKnee], w[P.leftAnkle]);
    const kneeR = angle(w[P.rightHip], w[P.rightKnee], w[P.rightAnkle]);
    const hipL = angle(w[P.leftShoulder], w[P.leftHip], w[P.leftKnee]);
    const hipR = angle(w[P.rightShoulder], w[P.rightHip], w[P.rightKnee]);
    const minKnee = Math.min(kneeL, kneeR);
    const lean = angleFromVertical(mid(w[P.leftHip], w[P.rightHip]), mid(w[P.leftShoulder], w[P.rightShoulder]));

    const cues: Cue[] = [];
    if (s.phase === "top") {
      if (minKnee < DOWN_START) s = { ...fresh(f.t), phase: "down" };
      else return { state: s, cues, phase: "Upp" };
    }
    // Främre ben: mest böjd höft (lägst höftvinkel).
    const front: Side = hipL < hipR ? "left" : "right";
    const fk = front === "left" ? kneeL : kneeR;
    const bk = front === "left" ? kneeR : kneeL;
    const [hip, knee, ankle] =
      front === "left" ? [w[P.leftHip], w[P.leftKnee], w[P.leftAnkle]] : [w[P.rightHip], w[P.rightKnee], w[P.rightAnkle]];
    // Knä inåt: knäets sidledsavvikelse från linjen höft→fotled (x-led).
    const tLine = (knee.y - hip.y) / ((ankle.y - hip.y) || 1e-6);
    const lineX = hip.x + tLine * (ankle.x - hip.x);
    const valgus = Math.abs(knee.x - lineX); // sidledsavvikelse i meter, oavsett riktning

    s = {
      ...s,
      front: s.front ?? front,
      minFront: Math.min(s.minFront, fk),
      minBack: Math.min(s.minBack, bk),
      maxLean: Math.max(s.maxLean, lean),
      maxValgus: fk < 130 ? Math.max(s.maxValgus, valgus) : s.maxValgus,
    };
    if (fk < 130 && valgus > VALGUS_MAX) cues.push({ id: "knee_in", text: "Knät i linje med tårna", priority: 1 });
    if (lean > LEAN_MAX + 5) cues.push({ id: "lean", text: "Rak överkropp", priority: 2 });

    if (f.t - s.started > MAX_REP_MS) return { state: fresh(f.t), cues, phase: "Upp" };

    if (minKnee > TOP) {
      const faults: string[] = [];
      if (s.minFront > FRONT_OK) faults.push("shallow");
      if (s.minBack > BACK_OK) faults.push("back_knee");
      if (s.maxValgus > VALGUS_MAX) faults.push("knee_in");
      if (s.maxLean > LEAN_MAX) faults.push("lean");
      if (faults.includes("back_knee")) cues.push({ id: "back_knee", text: "Sänk bakre knät mot golvet", priority: 2 });
      else if (faults.includes("shallow")) cues.push({ id: "shallow", text: "Lite längre ner", priority: 2 });
      else if (!faults.length) cues.push({ id: "good", text: "Bra!", priority: 3 });
      return {
        state: fresh(f.t),
        cues,
        phase: "Upp",
        rep: {
          side: s.front ?? front,
          good: faults.length === 0,
          faults,
          metrics: { front: Math.round(s.minFront), back: Math.round(s.minBack), lean: Math.round(s.maxLean) },
        },
      };
    }
    return { state: s, cues, phase: "Ner" };
  },
};
