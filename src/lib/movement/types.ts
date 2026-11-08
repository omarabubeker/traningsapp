// Gemensamma typer för rörelsecoachen. Inga beroenden till kamera eller DOM,
// så att reglerna kan testas med inspelade eller syntetiska landmärken.

export type Vec3 = { x: number; y: number; z: number };
export type ImageLandmark = Vec3 & { visibility?: number };

/** En bildruta: 3D-världslandmärken (meter, höften i origo, y nedåt) + 2D-bildlandmärken (0–1). */
export type PoseFrame = { t: number; world: Vec3[]; image: ImageLandmark[] };

export type Cue = {
  id: string; // samma id = samma instruktion (styr upprepning)
  text: string;
  /** 0 = säkerhet, 1 = viktigt fel, 2 = mindre fel, 3 = beröm/info */
  priority: 0 | 1 | 2 | 3;
};

export type RepEvent = {
  side?: "left" | "right";
  good: boolean;
  faults: string[];
  metrics: Record<string, number>;
};

export type RuleOutput<S> = {
  state: S;
  rep?: RepEvent;
  /** Millisekunder godkänd hålltid som tillkommit i den här rutan (planka). */
  holdMs?: number;
  cues: Cue[];
  /** Kort status för skärmen, t.ex. "Ner" / "Upp" / "Håll". */
  phase?: string;
  /** Fel i just den här rutan (används för hållövningar som saknar reps). */
  frameFaults?: string[];
};

export type MovementKey = "squat" | "lunge" | "plank";

export type RequiredLandmarks = { left: number[]; right: number[]; common?: number[] };

export interface MovementRule<S = unknown> {
  key: MovementKey;
  name: string;
  kind: "reps" | "hold";
  /**
   * Landmärken som måste synas för att räkna (MediaPipe-index). Det räcker att en hel
   * sida syns (vänster eller höger), så att övningen fungerar även rakt från sidan.
   */
  required: RequiredLandmarks;
  /** Står/ligger personen i startposition? Styr nedräkningen 3–2–1. */
  ready(frame: PoseFrame): boolean;
  /** Uppställning: vinkel och avstånd. */
  setup: string;
  /** Vilka fel som kan bedömas från rekommenderad vinkel. */
  faultLabels: Record<string, string>;
  init(): S;
  update(frame: PoseFrame, state: S): RuleOutput<S>;
}

/** MediaPipe Pose-index som används. */
export const P = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFoot: 31,
  rightFoot: 32,
} as const;
