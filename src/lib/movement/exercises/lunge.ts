import { angle, angleFromVertical, mid } from "../geometry";
import { P, type Cue, type MovementRule, type PoseFrame, type RuleOutput } from "../types";

// Utfallssteg (framåt, bakåt eller på stället). Fungerar framifrån och från sidan.
//
// Kalibrerat mot riktiga inspelningar (pose_recordings, nov 2026):
//   höft→fotled-höjd stående ~0,78 m; bra steg 0,37–0,50 (sänkning ~0,5–0,6), grunt ~0,56 (~0,72)
//   från sidan rör sig knät framåt i bildens x-led (0,3–0,45 m) – det är INTE knä inåt
//   framifrån var knäets sidledsavvikelse −0,04…+0,11 m (utåt) på bra steg
// Därför: knä inåt bara framifrån och bara inåt mot mitten; bakre knä och bållutning bara från sidan.

const TOP_KNEE = 135;
const DOWN_DROP = 0.9;
const TOP_DROP = 0.92;
const REP_MIN_DROP = 0.85;
const DEPTH_DROP = 0.68; // godkänt djup via höftsänkning …
const FRONT_KNEE_OK = 100; // … eller främre knävinkel från sidan
const BACK_KNEE_OK = 120; // bakre knät ska böjas ordentligt (från sidan)
const LEAN_MAX = 25;
const VALGUS_IN = 0.12; // m knä inåt från linjen höft→fotled (framifrån)
const FRONT_VIEW = 0.45;
const MIN_REP_MS = 800;
const MAX_REP_MS = 8000;
const FAULT_MS = 300;

type Side = "left" | "right";
type State = {
  phase: "top" | "down";
  started: number;
  leftTop: number | null;
  baseHeight: number | null;
  minDrop: number;
  minFront: number;
  minBack: number;
  maxLean: number;
  front: Side | null;
  frontView: boolean;
  faultSince: Record<string, number>;
  faults: string[];
};

const fresh = (t: number, keep?: State): State => ({
  phase: "top",
  started: t,
  leftTop: null,
  baseHeight: keep?.baseHeight ?? null,
  minDrop: 1,
  minFront: 180,
  minBack: 180,
  maxLean: 0,
  front: null,
  frontView: false,
  faultSince: {},
  faults: [],
});

function track(s: State, key: string, active: boolean, t: number): State {
  if (!active) {
    if (!(key in s.faultSince)) return s;
    const rest = { ...s.faultSince };
    delete rest[key];
    return { ...s, faultSince: rest };
  }
  const since = s.faultSince[key] ?? t;
  const faults = t - since >= FAULT_MS && !s.faults.includes(key) ? [...s.faults, key] : s.faults;
  return { ...s, faultSince: { ...s.faultSince, [key]: since }, faults };
}

function measure(f: PoseFrame) {
  const w = f.world;
  const kneeL = angle(w[P.leftHip], w[P.leftKnee], w[P.leftAnkle]);
  const kneeR = angle(w[P.rightHip], w[P.rightKnee], w[P.rightAnkle]);
  const hipL = angle(w[P.leftShoulder], w[P.leftHip], w[P.leftKnee]);
  const hipR = angle(w[P.rightShoulder], w[P.rightHip], w[P.rightKnee]);
  const front: Side = hipL < hipR ? "left" : "right"; // främre ben = mest böjd höft
  const height = ((w[P.leftAnkle].y + w[P.rightAnkle].y) / 2) - ((w[P.leftHip].y + w[P.rightHip].y) / 2);
  const lean = angleFromVertical(mid(w[P.leftHip], w[P.rightHip]), mid(w[P.leftShoulder], w[P.rightShoulder]));
  const shoulderW = Math.abs(w[P.leftShoulder].x - w[P.rightShoulder].x);
  const torso = Math.abs(mid(w[P.leftHip], w[P.rightHip]).y - mid(w[P.leftShoulder], w[P.rightShoulder]).y) || 1e-6;
  const frontView = shoulderW / torso > FRONT_VIEW;
  // Knä inåt: avvikelse från linjen höft→fotled i x-led, med tecken mot kroppens mitt.
  const inward = (hip: { x: number; y: number }, knee: { x: number; y: number }, ankle: { x: number; y: number }) => {
    const t = (knee.y - hip.y) / ((ankle.y - hip.y) || 1e-6);
    const lineX = hip.x + t * (ankle.x - hip.x);
    const towardMid = Math.sign(-hip.x) || 1; // vänster höft har +x, mitten ligger mot 0
    return (knee.x - lineX) * towardMid;
  };
  const inL = inward(w[P.leftHip], w[P.leftKnee], w[P.leftAnkle]);
  const inR = inward(w[P.rightHip], w[P.rightKnee], w[P.rightAnkle]);
  return {
    kneeL, kneeR, front, height, lean, frontView,
    frontKnee: front === "left" ? kneeL : kneeR,
    backKnee: front === "left" ? kneeR : kneeL,
    frontInward: front === "left" ? inL : inR,
    minKnee: Math.min(kneeL, kneeR),
  };
}

export const lunge: MovementRule<State> = {
  key: "lunge",
  name: "Utfallssteg",
  kind: "reps",
  required: {
    left: [P.leftShoulder, P.leftHip, P.leftKnee, P.leftAnkle],
    right: [P.rightShoulder, P.rightHip, P.rightKnee, P.rightAnkle],
  },
  setup: "Ställ telefonen i höfthöjd 2–3 m bort. Från sidan bedöms djup, bakre knä och bållutning; framifrån bedöms om främre knät faller inåt. Hela kroppen ska synas genom hela steget.",
  faultLabels: {
    shallow: "För grunt",
    back_knee: "Bakre knät går inte ner",
    knee_in: "Främre knät faller inåt",
    lean: "Bålen lutar för mycket",
  },
  init: () => fresh(0),
  ready: (f) => measure(f).minKnee > TOP_KNEE,
  update(f, s0) {
    const out = updateLunge(f, s0);
    const m = measure(f);
    const base = out.state.baseHeight;
    out.debug = {
      vy: m.frontView ? "fram" : "sida",
      främre: m.front === "left" ? "vänster" : "höger",
      "knä fram": Math.round(m.frontKnee),
      "knä bak": Math.round(m.backKnee),
      sänkning: base ? Math.round((m.height / base) * 100) / 100 : "–",
      "knä inåt": Math.round(m.frontInward * 100) + " cm",
      lutning: Math.round(m.lean),
    };
    return out;
  },
};

function updateLunge(f: PoseFrame, s: State): RuleOutput<State> {
  const m = measure(f);
  const cues: Cue[] = [];

  if (s.phase === "top") {
    if (m.minKnee > TOP_KNEE && (s.baseHeight === null || m.height > s.baseHeight * 0.92)) {
      s = { ...s, baseHeight: s.baseHeight === null ? m.height : s.baseHeight + 0.1 * (m.height - s.baseHeight) };
    }
    const drop = s.baseHeight ? m.height / s.baseHeight : 1;
    const leaving = drop < TOP_DROP || m.minKnee < TOP_KNEE;
    const leftTop = leaving ? (s.leftTop ?? f.t) : null;
    if (drop < DOWN_DROP) s = { ...fresh(leftTop ?? f.t, s), phase: "down" };
    else return { state: { ...s, leftTop }, cues, phase: "Upp" };
  }

  const drop = s.baseHeight ? m.height / s.baseHeight : 1;
  const deep = drop < 0.8;
  s = {
    ...s,
    minDrop: Math.min(s.minDrop, drop),
    minFront: Math.min(s.minFront, m.frontKnee),
    minBack: Math.min(s.minBack, m.backKnee),
    maxLean: m.frontView ? s.maxLean : Math.max(s.maxLean, m.lean),
    front: s.front ?? (deep ? m.front : null),
    frontView: s.frontView || m.frontView,
  };
  s = track(s, "knee_in", deep && m.frontView && m.frontInward > VALGUS_IN, f.t);
  s = track(s, "lean", !m.frontView && m.lean > LEAN_MAX, f.t);
  if (s.faults.includes("knee_in") && s.faultSince.knee_in !== undefined) cues.push({ id: "knee_in", text: "Knät i linje med tårna", priority: 1 });
  if (s.faults.includes("lean") && s.faultSince.lean !== undefined) cues.push({ id: "lean", text: "Rak överkropp", priority: 2 });

  if (f.t - s.started > MAX_REP_MS) return { state: fresh(f.t, s), cues, phase: "Upp" };

  if (drop > TOP_DROP && m.minKnee > TOP_KNEE) {
    const real = s.minDrop < REP_MIN_DROP && f.t - s.started >= MIN_REP_MS;
    if (!real) return { state: fresh(f.t, s), cues, phase: "Upp" };
    const faults = [...s.faults];
    const deepEnough = s.minDrop <= DEPTH_DROP || (!s.frontView && s.minFront <= FRONT_KNEE_OK);
    if (!deepEnough) faults.unshift("shallow");
    // Bakre knä bedöms bara från sidan och bara om steget i övrigt var djupt nog.
    if (!s.frontView && deepEnough && s.minBack > BACK_KNEE_OK) faults.push("back_knee");
    if (faults.includes("back_knee")) cues.push({ id: "back_knee", text: "Sänk bakre knät mot golvet", priority: 2 });
    else if (faults.includes("shallow")) cues.push({ id: "shallow", text: "Lite längre ner", priority: 2 });
    else if (!faults.length) cues.push({ id: "good", text: "Bra!", priority: 3 });
    return {
      state: fresh(f.t, s),
      cues,
      phase: "Upp",
      rep: {
        side: s.front ?? m.front,
        good: faults.length === 0,
        faults,
        metrics: { drop: Math.round(s.minDrop * 100) / 100, front: Math.round(s.minFront), back: Math.round(s.minBack), lean: Math.round(s.maxLean) },
      },
    };
  }
  return { state: s, cues, phase: "Ner" };
}
