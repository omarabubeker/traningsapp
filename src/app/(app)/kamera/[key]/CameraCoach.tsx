"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { MOVEMENTS } from "@/lib/movement/registry";
import { CueScheduler } from "@/lib/movement/cueScheduler";
import { PointFilter } from "@/lib/movement/oneEuro";
import { bodyVisible, VisibilityGate } from "@/lib/movement/visibility";
import { TechniqueSession, type TechniqueSummary } from "@/lib/movement/session";
import { bestSwedishVoice, loadSettings, speak } from "@/lib/movement/voice";
import { saveCameraSet } from "@/lib/movement/save";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MovementKey, PoseFrame } from "@/lib/movement/types";

type Phase = "setup" | "loading" | "live" | "paused" | "summary" | "error";
type Live = { reps: number; good: number; holdS: number; phase: string; cue: string | null; hidden: boolean; fps: number };

const NOT_VISIBLE = "Vi ser dig inte helt – backa lite";
// Skelettets linjer (MediaPipe-index), utan ansiktet.
const BONES: [number, number][] = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32],
];

export function CameraCoach({ movementKey }: { movementKey: MovementKey }) {
  const rule = MOVEMENTS[movementKey];
  const hold = rule.kind === "hold";
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const run = useRef<{
    stream?: MediaStream;
    lm?: PoseLandmarker;
    stop: boolean;
    state: unknown;
    session: TechniqueSession;
    filter: PointFilter;
    cues: CueScheduler;
    gate: VisibilityGate;
    lastVideoTime: number;
    frames: number[];
    lastUi: number;
    voice: SpeechSynthesisVoice | null;
    voiceOn: boolean;
    model: string;
  } | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [weight, setWeight] = useState("0");
  const [live, setLive] = useState<Live>({ reps: 0, good: 0, holdS: 0, phase: "", cue: null, hidden: false, fps: 0 });
  const [summary, setSummary] = useState<TechniqueSummary | null>(null);
  const [saved, setSaved] = useState<{ ok: boolean; sessionId?: string; error?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = ok, annars vilken modell som går långsamt
  const [slow, setSlow] = useState<null | string>(null);

  // --- Kamera och modell ---------------------------------------------------------------
  const stopCamera = useCallback(() => {
    const r = run.current;
    if (!r) return;
    r.stop = true;
    r.stream?.getTracks().forEach((t) => t.stop());
    r.stream = undefined;
    if (videoRef.current) videoRef.current.srcObject = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }, []);

  useEffect(() => () => {
    stopCamera();
    run.current?.lm?.close();
  }, [stopCamera]);

  // Stäng kameran när appen göms (byter app, låser skärmen).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && run.current && !run.current.stop) {
        stopCamera();
        setPhase("paused");
      }
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [stopCamera]);

  async function createLandmarker(model: string) {
    const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
    const opts = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: `/mediapipe/models/pose_landmarker_${model}.task`, delegate },
      runningMode: "VIDEO" as const,
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    try {
      return await PoseLandmarker.createFromOptions(fileset, opts("GPU"));
    } catch {
      return await PoseLandmarker.createFromOptions(fileset, opts("CPU"));
    }
  }

  async function start(resume = false) {
    setError(null);
    setPhase("loading");
    const settings = loadSettings();
    const voice = bestSwedishVoice(settings.voiceName);
    // Talsyntesen måste "låsas upp" av en tryckning på iOS.
    if (settings.voice && !resume) speak(hold ? "Gå ner i planka när du är redo" : "Nu kör vi", voice);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      const lm = run.current?.lm ?? (await createLandmarker(settings.model));
      const prev = run.current;
      run.current = {
        stream,
        lm,
        stop: false,
        state: resume && prev ? prev.state : rule.init(),
        session: resume && prev ? prev.session : new TechniqueSession(rule),
        filter: new PointFilter(),
        cues: resume && prev ? prev.cues : new CueScheduler(),
        gate: new VisibilityGate(),
        lastVideoTime: -1,
        frames: [],
        lastUi: 0,
        voice,
        voiceOn: settings.voice,
        model: settings.model,
      };
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setPhase("live");
      requestAnimationFrame(loop);
    } catch (e) {
      console.error(e);
      stopCamera();
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Kameran nekades. Tillåt kameran för den här sidan i webbläsarens inställningar."
          : "Kunde inte starta kameran eller modellen.",
      );
      setPhase("error");
    }
  }

  // --- Bildloopen ---------------------------------------------------------------------
  // ts kommer från requestVideoFrameCallback/requestAnimationFrame (monoton tid i ms).
  function loop(ts: number) {
    const r = run.current;
    const video = videoRef.current;
    if (!r || r.stop || !video) return;
    const next = () => {
      const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number) => void) => number };
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(loop);
      else requestAnimationFrame(loop);
    };
    if (video.readyState < 2 || video.currentTime === r.lastVideoTime) return next();
    r.lastVideoTime = video.currentTime;
    const now = ts;
    let res;
    try {
      res = r.lm!.detectForVideo(video, now);
    } catch (e) {
      console.error(e);
      return next();
    }
    r.frames = [...r.frames.filter((t) => now - t < 1000), now];

    const image = res.landmarks[0];
    const worldRaw = res.worldLandmarks[0];
    let cueText: string | null = null;
    let hidden = false;
    let phaseLabel = "";
    if (!image || !worldRaw) {
      hidden = !r.gate.update(false, now);
    } else {
      const world = r.filter.apply(worldRaw, now);
      const visible = bodyVisible(image, rule.required);
      hidden = !r.gate.update(visible, now);
      if (visible) {
        const frame: PoseFrame = { t: now, world, image };
        const out = rule.update(frame, r.state as never);
        r.state = out.state;
        r.session.add(out, now);
        phaseLabel = out.phase ?? "";
        const cue = r.cues.pick(out.cues, now);
        if (cue) cueText = cue.text;
      }
    }
    if (hidden) {
      const cue = r.cues.pick([{ id: "hidden", text: NOT_VISIBLE, priority: 0 }], now);
      if (cue) cueText = cue.text;
    }
    if (cueText && r.voiceOn) speak(cueText, r.voice);
    draw(image, hidden);

    // Uppdatera skärmen högst ~8 gånger/s (eller direkt vid ny instruktion).
    if (cueText || now - r.lastUi > 120) {
      r.lastUi = now;
      const s = r.session;
      const fps = r.frames.length;
      setLive((l) => ({
        reps: s.reps,
        good: s.goodReps,
        holdS: Math.floor(s.holdMs / 1000),
        phase: phaseLabel || l.phase,
        cue: cueText ?? (hidden ? NOT_VISIBLE : l.cue),
        hidden,
        fps,
      }));
      if (now - (r.frames[0] ?? now) > 900) setSlow(fps < 15 ? r.model : null);
    }
    next();
  }

  function draw(image: { x: number; y: number; visibility?: number }[] | undefined, hidden: boolean) {
    const c = canvasRef.current, v = videoRef.current;
    if (!c || !v) return;
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (!image) return;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.strokeStyle = hidden ? "rgba(224,122,122,0.8)" : "rgba(124,196,164,0.9)";
    for (const [a, b] of BONES) {
      const p = image[a], q = image[b];
      if ((p.visibility ?? 1) < 0.4 || (q.visibility ?? 1) < 0.4) continue;
      ctx.beginPath();
      ctx.moveTo(p.x * c.width, p.y * c.height);
      ctx.lineTo(q.x * c.width, q.y * c.height);
      ctx.stroke();
    }
    ctx.fillStyle = "#e8ecee";
    for (const i of [11, 12, 23, 24, 25, 26, 27, 28]) {
      const p = image[i];
      if ((p.visibility ?? 1) < 0.4) continue;
      ctx.beginPath();
      ctx.arc(p.x * c.width, p.y * c.height, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Avsluta och spara ------------------------------------------------------------------
  async function finish() {
    const r = run.current;
    stopCamera();
    if (!r) return;
    const s = r.session.summary();
    setSummary(s);
    setPhase("summary");
    if ((hold ? s.holdS : s.reps) === 0) return setSaved({ ok: false, error: "Inget att spara – inga reps räknades." });
    try {
      const id = await saveCameraSet(supabaseBrowser(), movementKey, s, Number(weight.replace(",", ".")) || 0, r.model);
      setSaved({ ok: true, sessionId: id });
    } catch (e) {
      console.error(e);
      setSaved({ ok: false, error: "Kunde inte spara i gymloggen (kräver uppkoppling)." });
    }
  }

  function again() {
    run.current?.lm?.close();
    run.current = null;
    setSummary(null);
    setSaved(null);
    setLive({ reps: 0, good: 0, holdS: 0, phase: "", cue: null, hidden: false, fps: 0 });
    setPhase("setup");
  }

  // --- Vy ---------------------------------------------------------------------------------
  const showCamera = phase === "live" || phase === "loading";
  return (
    <main className="pt-3">
      {!showCamera && (
        <header className="mb-4 flex items-center gap-3">
          <Link href="/kamera" className="-ml-2 px-2 py-2 text-muted" aria-label="Tillbaka">←</Link>
          <h1 className="text-xl font-semibold">{rule.name}</h1>
        </header>
      )}

      {(phase === "setup" || phase === "error") && (
        <section className="space-y-4">
          <div className="card space-y-2 text-sm">
            <p className="font-medium">Uppställning</p>
            <p className="text-muted">{rule.setup}</p>
            <p className="text-muted">
              Kameran bedömer: {Object.values(rule.faultLabels).join(", ").toLowerCase()}. Ingen bild sparas.
            </p>
          </div>
          {!hold && (
            <div className="card">
              <label className="label" htmlFor="w">Vikt (kg, 0 = kroppsvikt)</label>
              <input id="w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="field text-lg" />
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <button onClick={() => start()} className="btn-primary w-full text-lg">Starta kameran</button>
        </section>
      )}

      {phase === "paused" && (
        <section className="card space-y-3 text-center">
          <p>Kameran stängdes när du lämnade appen.</p>
          <button onClick={() => start(true)} className="btn-primary w-full">Fortsätt</button>
          <button onClick={finish} className="btn-ghost w-full">Avsluta och spara</button>
        </section>
      )}

      {/* Kameravy i helskärm */}
      <div className={showCamera ? "fixed inset-0 z-40 bg-black" : "hidden"}>
        <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full -scale-x-100 object-contain" />

        <div className="pt-safe absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/70 to-transparent px-4 pb-8">
          <div>
            <p className="text-sm text-white/70">{rule.name}</p>
            <p className="text-5xl font-semibold tabular-nums text-white">
              {hold ? `${Math.floor(live.holdS / 60)}:${String(live.holdS % 60).padStart(2, "0")}` : live.reps}
            </p>
            {!hold && live.reps > 0 && <p className="text-sm text-white/70">{live.good} med god teknik</p>}
          </div>
          <div className="text-right text-xs text-white/60">
            <p>{live.phase}</p>
            <p>{live.fps} fps</p>
          </div>
        </div>

        {phase === "loading" && (
          <p className="absolute inset-x-0 top-1/2 text-center text-white/80">Startar kamera och modell…</p>
        )}

        {live.cue && phase === "live" && (
          <div className="absolute inset-x-4 top-1/3 flex justify-center">
            <p className={`rounded-2xl px-5 py-3 text-center text-2xl font-semibold shadow-lg ${live.hidden ? "bg-danger text-black" : "bg-black/75 text-white"}`}>
              {live.cue}
            </p>
          </div>
        )}

        <div className="pb-safe absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/80 to-transparent px-4 pt-10">
          {slow && (
            <p className="text-center text-xs text-gym">
              Låg bildfrekvens –{" "}
              {slow === "full" ? "välj ”Snabb” modell under Teknik med kamera." : "stäng andra appar och se till att telefonen inte är i strömsparläge."}
            </p>
          )}
          <button onClick={finish} className="btn-primary w-full text-lg">Klar</button>
        </div>
      </div>

      {phase === "summary" && summary && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {hold ? (
              <Stat label="Hålltid" value={`${Math.floor(summary.holdS / 60)}:${String(summary.holdS % 60).padStart(2, "0")}`} />
            ) : (
              <Stat label="Reps" value={String(summary.reps)} />
            )}
            {hold ? (
              <Stat label="Tid med fel" value={`${Object.values(summary.faults).reduce((s, x) => s + x, 0)} s`} />
            ) : (
              <Stat label="God teknik" value={summary.reps ? `${Math.round((summary.goodReps / summary.reps) * 100)} %` : "–"} />
            )}
          </div>
          {summary.perSide && (
            <p className="card text-sm">Vänster ben fram: {summary.perSide.left} · Höger ben fram: {summary.perSide.right}</p>
          )}
          <div className="card space-y-2">
            <p className="font-medium">Vanligaste felen</p>
            {(hold ? summary.holdS : summary.reps) === 0 ? (
              <p className="text-sm text-muted">Inget registrerades. Kontrollera att hela kroppen syns och försök igen.</p>
            ) : summary.topFaults.length === 0 ? (
              <p className="text-sm text-accent">Inga fel upptäcktes – snyggt!</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {summary.topFaults.map((f) => (
                  <li key={f.key} className="flex justify-between">
                    <span>{f.label}</span>
                    <span className="text-muted">{hold ? `${f.count} s` : `${f.count} av ${summary.reps}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {saved?.ok && (
            <Link href={`/gym/${saved.sessionId}`} className="card block text-sm text-accent">✓ Sparat i gymloggen – visa passet →</Link>
          )}
          {saved && !saved.ok && <p className="card text-sm text-muted">{saved.error}</p>}
          <button onClick={again} className="btn-primary w-full">Nytt set</button>
          <Link href="/kamera" className="btn-ghost w-full">Byt övning</Link>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
