import { describe, expect, it } from "vitest";
import { pushup } from "./exercises/pushup";
import { deadlift } from "./exercises/deadlift";
import { angle } from "./geometry";
import { deadliftPose, frame, path, pushupPose } from "./__fixtures__/synthetic";
import type { MovementRule, RepEvent } from "./types";
import { P } from "./types";

function run<S>(rule: MovementRule<S>, worlds: ReturnType<typeof pushupPose>[]) {
  let state = rule.init();
  const reps: RepEvent[] = [];
  const cues: string[] = [];
  worlds.forEach((w, i) => {
    const out = rule.update(frame((i * 1000) / 30, w), state);
    state = out.state;
    if (out.rep) reps.push(out.rep);
    cues.push(...out.cues.map((c) => c.id));
  });
  return { reps, cues };
}

describe("armhävningar", () => {
  it("syntetisk kropp ger rätt armbågsvinkel", () => {
    const w = pushupPose({ elbow: 90 });
    expect(angle(w[P.leftShoulder], w[P.leftElbow], w[P.leftWrist])).toBeCloseTo(90, 0);
  });
  it("räknar en djup rep med rak kropp", () => {
    const { reps } = run(pushup, path([170, 170, 85, 170, 170]).map((e) => pushupPose({ elbow: e })));
    expect(reps).toHaveLength(1);
    expect(reps[0]).toMatchObject({ good: true });
  });
  it("flaggar för grunt", () => {
    const { reps } = run(pushup, path([170, 170, 112, 170, 170]).map((e) => pushupPose({ elbow: e })));
    expect(reps[0].faults).toContain("shallow");
  });
  it("flaggar höft som sjunker", () => {
    const { reps } = run(pushup, path([170, 170, 85, 170, 170]).map((e) => pushupPose({ elbow: e, hipOffset: 0.15 })));
    expect(reps[0].faults).toContain("sag");
  });
  it("räknar inte när man står upp", () => {
    // Stående: rotera kroppen så att den är lodrät (byt y och z).
    const standing = path([170, 85, 170]).map((e) => pushupPose({ elbow: e }).map((p) => ({ x: p.x, y: -p.z, z: p.y })));
    expect(run(pushup, standing).reps).toHaveLength(0);
  });
  it("känner igen startposition", () => {
    expect(pushup.ready(frame(0, pushupPose({ elbow: 170 })))).toBe(true);
    expect(pushup.ready(frame(0, pushupPose({ elbow: 100 })))).toBe(false);
  });
});

describe("marklyft", () => {
  const rep = (leans: number[], thighs: number[]) => {
    const l = path(leans), t = path(thighs);
    return l.map((lean, i) => deadliftPose({ lean, thigh: t[i] }));
  };
  it("syntetisk kropp ger rätt höftvinkel", () => {
    const w = deadliftPose({ lean: 60, thigh: 35 });
    expect(angle(w[P.leftShoulder], w[P.leftHip], w[P.leftKnee])).toBeCloseTo(85, 0);
  });
  it("räknar ett bra lyft med utlåsning", () => {
    const { reps } = run(deadlift, rep([0, 0, 60, 60, 0, 0], [0, 0, 35, 35, 0, 0]));
    expect(reps).toHaveLength(1);
    expect(reps[0]).toMatchObject({ good: true, faults: [] });
  });
  it("flaggar när höften inte låses ut", () => {
    const { reps } = run(deadlift, rep([0, 0, 60, 60, 18, 18, 40], [0, 0, 35, 35, 0, 0, 20]));
    expect(reps[0].faults).toContain("no_lockout");
  });
  it("flaggar höften först (bålen fälls framåt i början av lyftet)", () => {
    // Knäna sträcks först medan bålen lutar mer, sedan reser sig bålen.
    const { reps } = run(deadlift, rep([0, 0, 55, 55, 75, 0, 0], [0, 0, 40, 40, 10, 0, 0]));
    expect(reps[0].faults).toContain("hips_first");
  });
  it("flaggar för mycket knäböj", () => {
    const { reps } = run(deadlift, rep([0, 0, 35, 35, 0, 0], [0, 0, 85, 85, 0, 0]));
    expect(reps[0].faults).toContain("squat");
  });
  it("räknar inte en liten nickning", () => {
    expect(run(deadlift, rep([0, 0, 30, 0, 0], [0, 0, 10, 0, 0])).reps).toHaveLength(0);
  });
});
