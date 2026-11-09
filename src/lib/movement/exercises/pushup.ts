import { angle, len, sub } from "../geometry";
import { P, type Cue, type MovementRule, type PoseFrame, type RuleOutput, type Vec3 } from "../types";

// Armhävningar. Filmas från sidan (telefonen på golvet eller låg höjd, 1,5–2 m bort).
// Reps via armbågsvinkeln (axel–armbåge–handled) på den sida som syns bäst.
// Kroppslinjen (axel–höft–fotled) bedöms som i plankan.
// Startvärden – kalibreras mot riktiga inspelningar.

const TOP_ELBOW = 150; // raka armar
const DOWN_ELBOW = 130; // repen börjar
const DEPTH_ELBOW = 100; // godkänt djup
const LOCKOUT_ELBOW = 155; // armarna ska sträckas ut i toppen
const REP_MIN_ELBOW = 120; // annars ingen rep (halv rörelse)
const HORIZONTAL_MAX = 40; // kroppen högst så här många grader från vågrätt
const LINE_DEV = 0.07; // höftens avvikelse från linjen, andel av kroppslängden
const HEAD_DROP = 0.12; // m näsan under axellinjen
const MIN_REP_MS = 600;
const MAX_REP_MS = 8000;
const FAULT_MS = 300;

type Side = { sh: Vec3; el: Vec3; wr: Vec3; hip: Vec3; ank: Vec3 };
type State = {
  phase: "top" | "down";
  started: number;
  leftTop: number | null;
  minElbow: number;
  maxElbowTop: number; // utsträckning före repen
  faultSince: Record<string, number>;
  faults: string[];
};

const fresh = (t: number): State => ({ phase: "top", started: t, leftTop: null, minElbow: 180, maxElbowTop: 0, faultSince: {}, faults: [] });

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

function pickSide(f: PoseFrame): Side {
  const w = f.world;
  const vis = (idx: number[]) => idx.reduce((s, i) => s + (f.image[i]?.visibility ?? 0), 0);
  const L = [P.leftShoulder, P.leftElbow, P.leftWrist, P.leftHip, P.leftAnkle];
  const R = [P.rightShoulder, P.rightElbow, P.rightWrist, P.rightHip, P.rightAnkle];
  const idx = vis(L) >= vis(R) ? L : R;
  return { sh: w[idx[0]], el: w[idx[1]], wr: w[idx[2]], hip: w[idx[3]], ank: w[idx[4]] };
}

function measure(f: PoseFrame) {
  const s = pickSide(f);
  const elbow = angle(s.sh, s.el, s.wr);
  const body = sub(s.ank, s.sh);
  const bodyLen = len(body) || 1e-6;
  const tilt = (Math.asin(Math.min(1, Math.abs(body.y) / bodyLen)) * 180) / Math.PI;
  const t = Math.max(0, Math.min(1, ((s.hip.x - s.sh.x) * body.x + (s.hip.z - s.sh.z) * body.z) / (body.x ** 2 + body.z ** 2 || 1e-6)));
  const dev = (s.hip.y - (s.sh.y + t * body.y)) / bodyLen; // y nedåt: positivt = höften sjunker
  const head = f.world[P.nose].y - s.sh.y;
  return { elbow, tilt, dev, head };
}

export const pushup: MovementRule<State> = {
  key: "pushup",
  name: "Armhävningar",
  kind: "reps",
  required: {
    left: [P.leftShoulder, P.leftElbow, P.leftWrist, P.leftHip, P.leftAnkle],
    right: [P.rightShoulder, P.rightElbow, P.rightWrist, P.rightHip, P.rightAnkle],
  },
  setup: "Lägg telefonen på golvet 1,5–2 m bort, rakt från sidan. Hela kroppen från huvud till fötter och armen närmast kameran ska synas.",
  faultLabels: {
    shallow: "För grunt",
    no_lockout: "Armarna sträcks inte ut",
    sag: "Höften sjunker",
    pike: "Höften för högt",
    head: "Huvudet hänger",
  },
  init: () => fresh(0),
  ready: (f) => {
    const m = measure(f);
    return m.tilt <= HORIZONTAL_MAX && m.elbow > TOP_ELBOW;
  },
  update(f, s0) {
    const out = updatePushup(f, s0);
    const m = measure(f);
    out.debug = {
      armbåge: Math.round(m.elbow),
      "kropp mot golv": Math.round(m.tilt) + "°",
      höft: Math.round(m.dev * 100) + " %",
      huvud: Math.round(m.head * 100) + " cm",
    };
    return out;
  },
};

function updatePushup(f: PoseFrame, s: State): RuleOutput<State> {
  const m = measure(f);
  const cues: Cue[] = [];
  if (m.tilt > HORIZONTAL_MAX) return { state: fresh(f.t), cues, phase: "Gå ner i armhävningsläge" };

  if (s.phase === "top") {
    const leaving = m.elbow < TOP_ELBOW;
    const leftTop = leaving ? (s.leftTop ?? f.t) : null;
    const maxElbowTop = leaving ? s.maxElbowTop : Math.max(s.maxElbowTop, m.elbow);
    if (m.elbow < DOWN_ELBOW) {
      s = { ...fresh(leftTop ?? f.t), phase: "down", maxElbowTop: Math.max(maxElbowTop, s.maxElbowTop) };
    } else {
      return { state: { ...s, leftTop, maxElbowTop }, cues, phase: "Upp" };
    }
  }

  s = { ...s, minElbow: Math.min(s.minElbow, m.elbow) };
  s = track(s, "sag", m.dev > LINE_DEV, f.t);
  s = track(s, "pike", m.dev < -LINE_DEV, f.t);
  s = track(s, "head", m.head > HEAD_DROP, f.t);
  if (s.faults.includes("sag") && s.faultSince.sag !== undefined) cues.push({ id: "sag", text: "Spänn magen, lyft höften", priority: 1 });
  if (s.faults.includes("pike") && s.faultSince.pike !== undefined) cues.push({ id: "pike", text: "Sänk höften", priority: 1 });
  if (s.faults.includes("head") && s.faultSince.head !== undefined) cues.push({ id: "head", text: "Huvudet i linje", priority: 2 });

  if (f.t - s.started > MAX_REP_MS) return { state: fresh(f.t), cues, phase: "Upp" };

  if (m.elbow > TOP_ELBOW) {
    const real = s.minElbow < REP_MIN_ELBOW && f.t - s.started >= MIN_REP_MS;
    const next = { ...fresh(f.t), maxElbowTop: m.elbow };
    if (!real) return { state: next, cues, phase: "Upp" };
    const faults = [...s.faults];
    if (s.minElbow > DEPTH_ELBOW) faults.unshift("shallow");
    if (s.maxElbowTop > 0 && s.maxElbowTop < LOCKOUT_ELBOW) faults.push("no_lockout");
    if (faults.includes("shallow")) cues.push({ id: "shallow", text: "Lite längre ner", priority: 2 });
    else if (!faults.length) cues.push({ id: "good", text: "Bra!", priority: 3 });
    return {
      state: next,
      cues,
      phase: "Upp",
      rep: { good: faults.length === 0, faults, metrics: { depth: Math.round(s.minElbow), top: Math.round(s.maxElbowTop) } },
    };
  }
  return { state: s, cues, phase: "Ner" };
}
