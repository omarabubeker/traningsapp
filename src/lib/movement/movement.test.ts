import { describe, expect, it } from "vitest";
import { squat } from "./exercises/squat";
import { lunge } from "./exercises/lunge";
import { plank } from "./exercises/plank";
import { CueScheduler } from "./cueScheduler";
import { VisibilityGate, bodyVisible } from "./visibility";
import { angle } from "./geometry";
import { frame, lungePose, plankPose, repAngles, squatPose } from "./__fixtures__/synthetic";
import type { MovementRule, RepEvent } from "./types";

function run<S>(rule: MovementRule<S>, worlds: ReturnType<typeof squatPose>[], fps = 30) {
  let state = rule.init();
  const reps: RepEvent[] = [];
  const cues: string[] = [];
  let holdMs = 0;
  worlds.forEach((w, i) => {
    const out = rule.update(frame((i * 1000) / fps, w), state);
    state = out.state;
    if (out.rep) reps.push(out.rep);
    if (out.holdMs) holdMs += out.holdMs;
    cues.push(...out.cues.map((c) => c.id));
  });
  return { reps, cues, holdMs };
}

describe("syntetiska kroppar", () => {
  it("ger förväntad knävinkel", () => {
    const w = squatPose({ kneeAngle: 95 });
    expect(angle(w[23], w[25], w[27])).toBeCloseTo(95, 0);
  });
});

describe("knäböj", () => {
  it("räknar en djup rep med god teknik", () => {
    const { reps } = run(squat, repAngles(90).map((a) => squatPose({ kneeAngle: a })));
    expect(reps).toHaveLength(1);
    expect(reps[0]).toMatchObject({ good: true, faults: [] });
    expect(reps[0].metrics.depth).toBeLessThanOrEqual(92);
  });
  it("flaggar för grunt", () => {
    const { reps, cues } = run(squat, repAngles(120).map((a) => squatPose({ kneeAngle: a })));
    expect(reps[0].faults).toContain("shallow");
    expect(cues).toContain("shallow");
  });
  it("flaggar knän som faller inåt", () => {
    const { reps, cues } = run(squat, repAngles(90).map((a) => squatPose({ kneeAngle: a, kneeInward: a < 125 ? 0.07 : 0 })));
    expect(reps[0].faults).toContain("knees_in");
    expect(cues).toContain("knees_in");
  });
  it("flaggar för mycket framåtlutning från sidan", () => {
    const { reps } = run(squat, repAngles(90).map((a) => squatPose({ kneeAngle: a, lean: a < 120 ? 70 : 15, shoulderX: 0.03 })));
    expect(reps[0].faults).toContain("lean");
  });
  it("bedömer inte framåtlutning framifrån (djupled osäker)", () => {
    const { reps } = run(squat, repAngles(90).map((a) => squatPose({ kneeAngle: a, lean: a < 120 ? 60 : 15 })));
    expect(reps[0].faults).not.toContain("lean");
  });
  it("räknar inte för snabba ryck som rep", () => {
    const { reps } = run(squat, repAngles(90, 5).map((a) => squatPose({ kneeAngle: a })));
    expect(reps).toHaveLength(0);
  });
  it("ignorerar fel som bara syns ett ögonblick", () => {
    const seq = repAngles(90);
    const { reps } = run(squat, seq.map((a, i) => squatPose({ kneeAngle: a, heelLift: i === 20 ? 0.08 : 0 })));
    expect(reps[0].faults).not.toContain("heels_up");
  });
  it("räknar inte en halv rörelse", () => {
    const { reps } = run(squat, repAngles(150).map((a) => squatPose({ kneeAngle: a })));
    expect(reps).toHaveLength(0);
  });
  it("räknar flera reps i rad", () => {
    const seq = [...repAngles(90), ...repAngles(95), ...repAngles(88)];
    const { reps } = run(squat, seq.map((a) => squatPose({ kneeAngle: a })));
    expect(reps).toHaveLength(3);
  });
});

describe("utfallssteg", () => {
  const seq = (front: "left" | "right", fBottom: number, bBottom: number) =>
    repAngles(fBottom).map((a) => {
      const p = Math.min(1, (175 - a) / (175 - fBottom));
      return lungePose(front, a, 175 - p * (175 - bBottom));
    });

  it("räknar rep och främre ben", () => {
    const { reps } = run(lunge, seq("left", 90, 95));
    expect(reps).toHaveLength(1);
    expect(reps[0]).toMatchObject({ side: "left", good: true });
  });
  it("flaggar bakre knä som inte går ner (från sidan)", () => {
    const { reps } = run(lunge, seq("right", 80, 150));
    expect(reps[0].side).toBe("right");
    expect(reps[0].faults).toContain("back_knee");
  });
  it("tolkar inte knät framåt från sidan som knä inåt", () => {
    // Från sidan rör sig främre knät framåt i bildens x-led – ingen valgus.
    const angles = repAngles(85);
    const worlds = seq("left", 85, 90).map((w, k) => {
      const bend = (175 - angles[k]) / (175 - 85); // 0 stående … 1 i botten
      return w.map((p, i) => (i === 25 || i === 26 ? { ...p, x: p.x + 0.35 * bend } : p));
    });
    const { reps } = run(lunge, worlds);
    expect(reps[0].faults).not.toContain("knee_in");
  });
});

describe("planka", () => {
  const seconds = (n: number, opts = {}) => Array.from({ length: n * 30 }, () => plankPose(opts));
  it("räknar hålltid med rak kropp", () => {
    const { holdMs } = run(plank, seconds(5));
    expect(holdMs / 1000).toBeGreaterThan(4.8);
  });
  it("pausar timern när höften sjunker längre än 2 s", () => {
    const { holdMs, cues } = run(plank, [...seconds(2), ...seconds(5, { hipOffset: 0.15 })]);
    expect(cues).toContain("sag");
    expect(holdMs / 1000).toBeGreaterThan(3.8);
    expect(holdMs / 1000).toBeLessThan(4.3); // 2 s rakt + 2 s nåd, sedan paus
  });
  it("räknar inte när man står upp", () => {
    const { holdMs } = run(plank, seconds(3, { tilt: 70 }));
    expect(holdMs).toBe(0);
  });
});

describe("instruktioner", () => {
  it("visar en i taget och upprepar inte samma inom 3,5 s", () => {
    const s = new CueScheduler();
    const c = { id: "knees_in", text: "Tryck ut knäna", priority: 1 as const };
    expect(s.pick([c], 0)?.id).toBe("knees_in");
    expect(s.pick([c], 2000)).toBeNull();
    expect(s.pick([c], 3600)?.id).toBe("knees_in");
  });
  it("prioriterar säkerhet och fel före beröm", () => {
    const s = new CueScheduler();
    const out = s.pick(
      [
        { id: "good", text: "Snyggt", priority: 3 },
        { id: "lean", text: "Bröstet upp", priority: 1 },
      ],
      0,
    );
    expect(out?.id).toBe("lean");
  });
  it("väntar minst 1,5 s mellan olika instruktioner", () => {
    const s = new CueScheduler();
    s.pick([{ id: "a", text: "A", priority: 1 }], 0);
    expect(s.pick([{ id: "b", text: "B", priority: 1 }], 1000)).toBeNull();
    expect(s.pick([{ id: "b", text: "B", priority: 1 }], 1600)?.id).toBe("b");
  });
});

describe("synlighet", () => {
  const req = { left: [11, 23, 25, 27], right: [12, 24, 26, 28] };
  const img = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
  it("räcker att en hel sida syns (rakt från sidan)", () => {
    const i = img();
    for (const k of req.left) i[k].visibility = 0.1; // bortre sidan skymd
    expect(bodyVisible(i, req)).toBe(true);
  });
  it("är osynlig när fötterna är utanför bild på båda sidor", () => {
    const i = img();
    i[27] = { x: 0.5, y: 1.2, z: 0, visibility: 0.9 };
    i[28] = { x: 0.5, y: 1.2, z: 0, visibility: 0.9 };
    expect(bodyVisible(i, req)).toBe(false);
  });
  it("väntar en stund innan kroppen räknas som borta", () => {
    const g = new VisibilityGate(1000);
    expect(g.update(false, 0)).toBe(true);
    expect(g.update(false, 1100)).toBe(false);
    expect(g.update(true, 1200)).toBe(true);
  });
});

describe("från sidan och startposition", () => {
  it("räknar knäböj när bortre sidan är skymd och använder den synliga sidan", () => {
    let state = squat.init();
    const reps: RepEvent[] = [];
    repAngles(90).forEach((a, i) => {
      const f = frame((i * 1000) / 30, squatPose({ kneeAngle: a }));
      // Vänster sida skymd: låg synlighet och skräpvärden i 3D.
      for (const k of [11, 23, 25, 27, 29, 31]) f.image[k].visibility = 0.1;
      f.world[25] = { x: -0.1, y: 0.45, z: 0 };
      const out = squat.update(f, state);
      state = out.state;
      if (out.rep) reps.push(out.rep);
    });
    expect(reps).toHaveLength(1);
    expect(reps[0].faults).not.toContain("knees_in");
    expect(reps[0].faults).not.toContain("asymmetry");
  });
  it("räknar knäböj rakt framifrån när djupled (z) är osäker", () => {
    // Framifrån skattar MediaPipe djupled dåligt: tryck ihop z så att knävinkeln ser rakare ut.
    const { reps } = run(
      squat,
      repAngles(90).map((a) => squatPose({ kneeAngle: a }).map((p) => ({ ...p, z: p.z * 0.2 }))),
    );
    expect(reps).toHaveLength(1);
    expect(reps[0].faults).not.toContain("shallow");
  });
  it("larmar inte om hälar när tån alltid ligger lägre än hälen", () => {
    const { reps } = run(squat, repAngles(90).map((a) => squatPose({ kneeAngle: a, heelLift: -0.05 })));
    expect(reps[0].faults).not.toContain("heels_up");
  });
  it("bedömer inte hälar (osäker mätning)", () => {
    const { reps } = run(squat, repAngles(90).map((a) => squatPose({ kneeAngle: a, heelLift: a < 120 ? 0.06 : 0 })));
    expect(reps[0].faults).not.toContain("heels_up");
  });
  it("känner igen startposition", () => {
    expect(squat.ready(frame(0, squatPose({ kneeAngle: 175 })))).toBe(true);
    expect(squat.ready(frame(0, squatPose({ kneeAngle: 120 })))).toBe(false);
    expect(plank.ready(frame(0, plankPose()))).toBe(true);
    expect(plank.ready(frame(0, plankPose({ tilt: 70 })))).toBe(false);
  });
});

describe("sammanställning av ett set", async () => {
  const { TechniqueSession } = await import("./session");
  it("räknar reps, god teknik och vanligaste fel", () => {
    const sess = new TechniqueSession(squat as never);
    let state = squat.init();
    const seq = [...repAngles(90), ...repAngles(120), ...repAngles(122), ...repAngles(92)];
    seq.forEach((a, i) => {
      const out = squat.update(frame((i * 1000) / 30, squatPose({ kneeAngle: a })), state);
      state = out.state;
      sess.add(out, (i * 1000) / 30);
    });
    const s = sess.summary();
    expect(s.reps).toBe(4);
    expect(s.goodReps).toBe(2);
    expect(s.topFaults[0]).toMatchObject({ key: "shallow", count: 2, label: "För grunt" });
  });
  it("räknar hålltid och felsekunder för planka", () => {
    const sess = new TechniqueSession(plank as never);
    let state = plank.init();
    const worlds = [...Array(90)].map(() => plankPose()).concat([...Array(60)].map(() => plankPose({ hipOffset: 0.15 })));
    worlds.forEach((w, i) => {
      const out = plank.update(frame((i * 1000) / 30, w), state);
      state = out.state;
      sess.add(out, (i * 1000) / 30);
    });
    const s = sess.summary();
    expect(s.holdS).toBe(5);
    expect(s.faults.sag).toBe(2);
  });
});
