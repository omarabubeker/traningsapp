import { len, sub } from "../geometry";
import { P, type Cue, type MovementRule, type PoseFrame, type Vec3 } from "../types";

// Planka. Rekommenderad vinkel: från sidan, telefonen på golvet eller låg höjd.
// Hålltid räknas bara när kroppen är i plankposition och linjen är rak.
// Ett fel som varar längre än 2 s pausar timern.

const HORIZONTAL_MAX = 35; // kroppen (axel→fotled) högst så här många grader från vågrätt
const LINE_DEV = 0.06; // höftens avvikelse från linjen axel–fotled, andel av kroppslängden
const HEAD_DROP = 0.12; // m näsan under axellinjen
const FAULT_GRACE_MS = 2000;

type State = { faultSince: number | null; lastT: number | null; inPosition: boolean };

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
    head: "Huvudet hänger",
  },
  init: () => ({ faultSince: null, lastT: null, inPosition: false }),
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
      return { state: { faultSince: null, lastT: f.t, inPosition: false }, cues, phase: "Gå ner i planka" };
    }
    // Höftens avstånd från linjen axel→fotled, i lodled (y nedåt: positivt = sjunker).
    const tt = Math.max(0, Math.min(1, ((hip.x - sh.x) * body.x + (hip.z - sh.z) * body.z) / (body.x ** 2 + body.z ** 2 || 1e-6)));
    const lineY = sh.y + tt * body.y;
    const dev = (hip.y - lineY) / bodyLen;
    const headDrop = w[P.nose].y - sh.y;

    const faults: string[] = [];
    if (dev > LINE_DEV) faults.push("sag");
    if (dev < -LINE_DEV) faults.push("pike");
    if (headDrop > HEAD_DROP) faults.push("head");
    if (faults.includes("sag")) cues.push({ id: "sag", text: "Lyft höften lite", priority: 1 });
    if (faults.includes("pike")) cues.push({ id: "pike", text: "Sänk höften", priority: 1 });
    if (faults.includes("head")) cues.push({ id: "head", text: "Håll huvudet i linje", priority: 2 });

    const faultSince = faults.length ? (s.faultSince ?? f.t) : null;
    const paused = faultSince !== null && f.t - faultSince > FAULT_GRACE_MS;
    return {
      state: { faultSince, lastT: f.t, inPosition: true },
      cues,
      holdMs: paused ? 0 : dt,
      phase: paused ? "Pausad – rätta till" : "Håll",
      frameFaults: faults,
    };
  },
};
