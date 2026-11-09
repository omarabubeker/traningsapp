import { angle, angleFromVertical } from "../geometry";
import { P, type Cue, type MovementRule, type PoseFrame, type RuleOutput } from "../types";

// Marklyft. Filmas från sidan, telefonen i höfthöjd 2–3 m bort.
// Reps via höftvinkeln (axel–höft–knä) på den sida som syns bäst:
// böjd vid stången → helt utlåst stående. Startvärden – kalibreras mot inspelningar.
//
// Kameran kan inte se ryggens rundning (bara axlar och höfter), så den bedöms inte.

const LOCKOUT_HIP = 165; // utlåst höft i toppen
const TOP_HIP = 155; // räknas som uppe
const DOWN_HIP = 135; // repen börjar
const REP_MIN_HIP = 115; // annars ingen rep (för liten rörelse)
const SQUAT_KNEE = 100; // knävinkel i botten under detta = för mycket knäböj
const HIPS_FIRST_DEG = 12; // bålen fälls framåt så här mycket i början av lyftet = höften först
const MIN_REP_MS = 800;
const MAX_REP_MS = 12000;

type State = {
  phase: "top" | "down" | "up";
  started: number;
  leftTop: number | null;
  minHip: number;
  minKnee: number;
  leanAtBottom: number;
  maxLeanUp: number;
  maxHipTop: number;
};

const fresh = (t: number): State => ({ phase: "top", started: t, leftTop: null, minHip: 180, minKnee: 180, leanAtBottom: 0, maxLeanUp: 0, maxHipTop: 0 });

function measure(f: PoseFrame) {
  const w = f.world;
  const vis = (idx: number[]) => idx.reduce((s, i) => s + (f.image[i]?.visibility ?? 0), 0);
  const left = vis([P.leftShoulder, P.leftHip, P.leftKnee, P.leftAnkle]) >= vis([P.rightShoulder, P.rightHip, P.rightKnee, P.rightAnkle]);
  const [sh, hip, knee, ank] = left
    ? [w[P.leftShoulder], w[P.leftHip], w[P.leftKnee], w[P.leftAnkle]]
    : [w[P.rightShoulder], w[P.rightHip], w[P.rightKnee], w[P.rightAnkle]];
  return { hip: angle(sh, hip, knee), knee: angle(hip, knee, ank), lean: angleFromVertical(hip, sh) };
}

export const deadlift: MovementRule<State> = {
  key: "deadlift",
  name: "Marklyft",
  kind: "reps",
  required: {
    left: [P.leftShoulder, P.leftHip, P.leftKnee, P.leftAnkle],
    right: [P.rightShoulder, P.rightHip, P.rightKnee, P.rightAnkle],
  },
  setup: "Ställ telefonen i höfthöjd 2–3 m bort, rakt från sidan. Hela kroppen och stången ska synas. Ryggens rundning kan kameran inte bedöma.",
  faultLabels: {
    no_lockout: "Höften låses inte ut",
    hips_first: "Höften går upp före bröstet",
    squat: "För mycket knäböj",
  },
  init: () => fresh(0),
  ready: (f) => measure(f).hip > TOP_HIP,
  update(f, s0) {
    const out = updateDeadlift(f, s0);
    const m = measure(f);
    out.debug = { höft: Math.round(m.hip), knä: Math.round(m.knee), bållutning: Math.round(m.lean) };
    return out;
  },
};

function updateDeadlift(f: PoseFrame, s: State): RuleOutput<State> {
  const m = measure(f);
  const cues: Cue[] = [];

  if (s.phase === "top") {
    const leaving = m.hip < TOP_HIP;
    const leftTop = leaving ? (s.leftTop ?? f.t) : null;
    if (m.hip < DOWN_HIP) s = { ...fresh(leftTop ?? f.t), phase: "down" };
    else return { state: { ...s, leftTop }, cues, phase: "Uppe" };
  }

  if (f.t - s.started > MAX_REP_MS) return { state: fresh(f.t), cues, phase: "Uppe" };

  if (s.phase === "down") {
    // På väg ner / vid stången: följ lägsta läget.
    if (m.hip <= s.minHip + 1) {
      s = { ...s, minHip: Math.min(s.minHip, m.hip), minKnee: Math.min(s.minKnee, m.knee), leanAtBottom: m.lean };
    } else if (m.hip > s.minHip + 8) {
      s = { ...s, phase: "up", maxLeanUp: m.lean }; // lyftet har börjat
    }
    return { state: s, cues, phase: "Ner" };
  }

  // Uppåt: höften först om bålen fälls framåt i första delen av lyftet.
  if (m.hip < s.minHip + 35) s = { ...s, maxLeanUp: Math.max(s.maxLeanUp, m.lean) };
  if (s.maxLeanUp - s.leanAtBottom > HIPS_FIRST_DEG) cues.push({ id: "hips_first", text: "Bröst och höft upp samtidigt", priority: 1 });
  s = { ...s, maxHipTop: Math.max(s.maxHipTop, m.hip) };

  // Klar när höften låsts ut, eller när den vänder nedåt igen utan att ha låsts ut.
  const locked = m.hip >= LOCKOUT_HIP;
  const turnedBack = s.maxHipTop > TOP_HIP && m.hip < s.maxHipTop - 4;
  if (locked || turnedBack) {
    const real = s.minHip < REP_MIN_HIP && f.t - s.started >= MIN_REP_MS;
    if (!real) return { state: fresh(f.t), cues, phase: "Uppe" };
    const faults: string[] = [];
    if (!locked) faults.push("no_lockout");
    if (s.maxLeanUp - s.leanAtBottom > HIPS_FIRST_DEG) faults.push("hips_first");
    if (s.minKnee < SQUAT_KNEE) faults.push("squat");
    if (faults.includes("no_lockout")) cues.push({ id: "no_lockout", text: "Lås ut höften – kläm ihop rumpan", priority: 1 });
    else if (!faults.length) cues.push({ id: "good", text: "Starkt!", priority: 3 });
    return {
      state: fresh(f.t),
      cues,
      phase: "Uppe",
      rep: {
        good: faults.length === 0,
        faults,
        metrics: { hipBottom: Math.round(s.minHip), kneeBottom: Math.round(s.minKnee), lockout: Math.round(Math.max(s.maxHipTop, m.hip)) },
      },
    };
  }
  return { state: s, cues, phase: "Upp" };
}
