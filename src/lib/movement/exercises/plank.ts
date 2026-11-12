import { bodyLine, len, sub } from "../geometry";
import { P, type Cue, type MovementRule, type PoseFrame, type Vec3 } from "../types";

// Planka. Rekommenderad vinkel: från sidan, telefonen på golvet eller låg höjd.
// Hålltid räknas bara när kroppen är i plankposition och linjen är rak.
// Ett fel som varar längre än 2 s pausar timern. Huvudläget bedöms inte (näsan ligger
// naturligt under axlarna i neutralt läge, vilket gav falsklarm vid armhävningar).

// Kalibrerat mot inspelning (nov 2026): rak kropp mäts som 169–173° i höften (axel–höft–fotled),
// uppskjuten höft 105–153°. Höftens avstånd från linjen (förra måttet) svajade för mycket.
const HORIZONTAL_MAX = 35; // kroppen (axel→fotled) högst så här många grader från vågrätt
const HIP_MIN = 158; // höftvinkel under detta = höften sjunker eller är för högt
const HIP_KNEES = 140; // under detta är man inte i planka (t.ex. på knäna) – ingen tid, inget tjat
const HIP_SMOOTH = 0.2; // utjämning av höftvinkeln (andel nytt värde per bildruta)
const CUE_AFTER_MS = 1000; // säg till först när felet hållit i sig en stund
const FAULT_GRACE_MS = 2000; // därefter pausas timern

type State = { faultSince: number | null; lastT: number | null; inPosition: boolean; hip: number | null; started: boolean };

function side(w: Vec3[], img: PoseFrame["image"]) {
  const visL = (img[P.leftShoulder]?.visibility ?? 0) + (img[P.leftHip]?.visibility ?? 0) + (img[P.leftAnkle]?.visibility ?? 0);
  const visR = (img[P.rightShoulder]?.visibility ?? 0) + (img[P.rightHip]?.visibility ?? 0) + (img[P.rightAnkle]?.visibility ?? 0);
  return visL >= visR
    ? { sh: w[P.leftShoulder], hip: w[P.leftHip], ank: w[P.leftAnkle] }
    : { sh: w[P.rightShoulder], hip: w[P.rightHip], ank: w[P.rightAnkle] };
}

export const plank: MovementRule<State> = {
  key: "plank",
  name: "Planka",
  kind: "hold",
  required: {
    left: [P.leftShoulder, P.leftHip, P.leftAnkle],
    right: [P.rightShoulder, P.rightHip, P.rightAnkle],
  },
  setup: "Lägg telefonen på golvet 1,5–2 m bort, rakt från sidan. Hela kroppen från huvud till fötter ska synas.",
  faultLabels: {
    sag: "Höften sjunker",
    pike: "Höften för högt",
  },
  init: () => ({ faultSince: null, lastT: null, inPosition: false, hip: null, started: false }),
  ready: (f) => {
    const { sh, ank } = side(f.world, f.image);
    const body = sub(ank, sh);
    return (Math.asin(Math.min(1, Math.abs(body.y) / (len(body) || 1e-6))) * 180) / Math.PI <= HORIZONTAL_MAX;
  },
  update(f: PoseFrame, s: State) {
    const w = f.world;
    const { sh, hip, ank } = side(w, f.image);
    const body = sub(ank, sh);
    const bodyLen = len(body) || 1e-6;
    const fromHorizontal = (Math.asin(Math.min(1, Math.abs(body.y) / bodyLen)) * 180) / Math.PI;
    const dt = s.lastT === null ? 0 : Math.min(200, f.t - s.lastT);
    const cues: Cue[] = [];

    if (fromHorizontal > HORIZONTAL_MAX) {
      return { state: { faultSince: null, lastT: f.t, inPosition: false, hip: null, started: s.started }, cues, phase: "Gå ner i planka" };
    }
    const line = bodyLine(sh, hip, ank);
    const hipAngle = s.hip === null ? line.hipAngle : s.hip + HIP_SMOOTH * (line.hipAngle - s.hip);
    // Bedömningen startar först när kroppen varit rak en gång (att lägga sig i position räknas inte).
    const started = s.started || hipAngle >= HIP_MIN;
    if (!started || hipAngle < HIP_KNEES) {
      return {
        state: { faultSince: null, lastT: f.t, inPosition: false, hip: hipAngle, started },
        cues,
        phase: started ? "Pausad – lyft knäna" : "Sträck ut kroppen",
        debug: { höft: Math.round(hipAngle) + "°", "kropp mot golv": Math.round(fromHorizontal) + "°" },
      };
    }
    const faults: string[] = hipAngle < HIP_MIN ? [line.dir] : [];

    const faultSince = faults.length ? (s.faultSince ?? f.t) : null;
    const lasting = faultSince !== null && f.t - faultSince >= CUE_AFTER_MS;
    if (lasting && faults.includes("sag")) cues.push({ id: "sag", text: "Lyft höften lite", priority: 1 });
    if (lasting && faults.includes("pike")) cues.push({ id: "pike", text: "Sänk höften", priority: 1 });
    const paused = faultSince !== null && f.t - faultSince > FAULT_GRACE_MS;
    return {
      state: { faultSince, lastT: f.t, inPosition: true, hip: hipAngle, started },
      cues,
      holdMs: paused ? 0 : dt,
      phase: paused ? "Pausad – rätta till" : "Håll",
      frameFaults: faults,
      debug: { höft: Math.round(hipAngle) + "°", "kropp mot golv": Math.round(fromHorizontal) + "°" },
    };
  },
};
