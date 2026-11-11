"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { MOVEMENTS } from "@/lib/movement/registry";
import { CueScheduler } from "@/lib/movement/cueScheduler";
import { PointFilter } from "@/lib/movement/oneEuro";
import { bodyVisible, VisibilityGate } from "@/lib/movement/visibility";
import { TechniqueSession, type TechniqueSummary } from "@/lib/movement/session";
import { bestSwedishVoice, loadSettings, saveSettings, speak } from "@/lib/movement/voice";
import { saveCameraSet } from "@/lib/movement/save";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { MovementKey, PoseFrame } from "@/lib/movement/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

type Phase = "setup" | "loading" | "live" | "paused" | "summary" | "error";
type Live = {
  reps: number;
  good: number;
  holdS: number;
  phase: string;
  cue: string | null;
  hidden: boolean;
  fps: number;
  countdown: number | null; // 3, 2, 1 före start
  waiting: string | null; // instruktion innan räkningen startat
  debug: Record<string, string | number> | null;
};
const EMPTY_LIVE: Live = { reps: 0, good: 0, holdS: 0, phase: "", cue: null, hidden: false, fps: 0, countdown: null, waiting: null, debug: null };
const COUNTDOWN_MS = 3000;
// Kalibrering: vilka punkter som spelas in (huvud, axlar, höfter, ben, fötter) och hur länge.
const REC_LANDMARKS = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const REC_MS = 30000;
type RecFrame = { t: number; w: number[][]; i: number[][] };
const r3 = (n: number) => Math.round(n * 1000) / 1000;

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
    mode: "waiting" | "countdown" | "active";
    countdownStart: number;
    lastCount: number | null;
    rec: { start: number; frames: RecFrame[] } | null;
  } | null>(null);

  const [phase, setPhase] = useState<Phase>("setup");
  const [weight, setWeight] = useState("0");
  const [live, setLive] = useState<Live>(EMPTY_LIVE);
  const [voiceOn, setVoiceOn] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [recStatus, setRecStatus] = useState<null | "recording" | "saving" | "saved" | "error">(null);
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

  // Modellen behålls mellan set och stängs först när sidan lämnas.
  const model = useRef<{ lm: PoseLandmarker; name: string; lastTs: number } | null>(null);
  useEffect(() => () => {
    stopCamera();
    model.current?.lm.close();
    model.current = null;
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
    setVoiceOn(settings.voice);
    // Talsyntesen måste "låsas upp" av en tryckning på iOS.
    if (settings.voice && !resume) speak("Ställ dig så att hela kroppen syns", voice);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        audio: false,
      });
      if (model.current && model.current.name !== settings.model) {
        model.current.lm.close();
        model.current = null;
      }
      if (!model.current) model.current = { lm: await createLandmarker(settings.model), name: settings.model, lastTs: 0 };
      const lm = model.current.lm;
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
        // Efter paus fortsätter räkningen direkt; annars väntar vi på startposition.
        mode: resume && prev?.mode === "active" ? "active" : "waiting",
        countdownStart: 0,
        lastCount: null,
        rec: null,
      };
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setPhase("live");
      const own = run.current;
      requestAnimationFrame((ts) => loop(own, ts));
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
  // Varje kamerastart har en egen loop som stannar så fort en ny start ersatt den
  // (annars kan två loopar skicka bilder i fel tidsordning och spårningen fryser).
  // ts kommer från requestVideoFrameCallback/requestAnimationFrame.
  function loop(r: typeof run.current, ts: number) {
    const video = videoRef.current;
    if (!r || r !== run.current || r.stop || !video) return;
    const next = () => {
      const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number) => void) => number };
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback((t) => loop(r, t));
      else requestAnimationFrame((t) => loop(r, t));
    };
    if (video.readyState < 2 || video.currentTime === r.lastVideoTime) return next();
    r.lastVideoTime = video.currentTime;
    // MediaPipe kräver strikt stigande tidsstämplar för samma modell.
    const m = model.current!;
    const now = Math.max(ts, m.lastTs + 1);
    m.lastTs = now;
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
    let countdown: number | null = null;
    let waiting: string | null = null;
    let debug: Record<string, string | number> | null = null;
    if (!image || !worldRaw) {
      hidden = !r.gate.update(false, now);
    } else {
      const world = r.filter.apply(worldRaw, now);
      // Kalibreringsinspelning: varannan ruta, bara siffror.
      if (r.rec && r.frames.length % 2 === 0) {
        r.rec.frames.push({
          t: Math.round(now - r.rec.start),
          w: REC_LANDMARKS.map((k) => [r3(worldRaw[k].x), r3(worldRaw[k].y), r3(worldRaw[k].z)]),
          i: REC_LANDMARKS.map((k) => [r3(image[k].x), r3(image[k].y), Math.round((image[k].visibility ?? 0) * 100) / 100]),
        });
        if (now - r.rec.start > REC_MS) saveRecording();
      }
      const visible = bodyVisible(image, rule.required);
      hidden = !r.gate.update(visible, now);
      const frame: PoseFrame = { t: now, world, image };
      if (r.mode !== "active") {
        // Nedräkning 3–2–1 när hela kroppen syns och personen står (ligger) redo.
        // När nedräkningen väl startat fortsätter den så länge kroppen syns.
        if (visible && (r.mode === "countdown" || rule.ready(frame))) {
          if (r.mode === "waiting") {
            r.mode = "countdown";
            r.countdownStart = now;
          }
          const left = Math.ceil((COUNTDOWN_MS - (now - r.countdownStart)) / 1000);
          if (left <= 0) {
            r.mode = "active";
            r.state = rule.init();
            cueText = "Kör!";
          } else {
            countdown = left;
            if (r.lastCount !== left) {
              r.lastCount = left;
              if (r.voiceOn) speak(String(left), r.voice);
            }
          }
        } else {
          r.mode = "waiting";
          r.lastCount = null;
          waiting = visible ? (hold ? "Gå ner i planka" : "Ställ dig upp, redo") : "Ställ dig så att hela kroppen syns";
        }
      } else if (visible) {
        const out = rule.update(frame, r.state as never);
        r.state = out.state;
        debug = out.debug ?? null;
        r.session.add(out, now);
        phaseLabel = out.phase ?? "";
        const cue = r.cues.pick(out.cues, now);
        if (cue) cueText = cue.text;
      }
    }
    if (hidden && r.mode === "active") {
      const cue = r.cues.pick([{ id: "hidden", text: NOT_VISIBLE, priority: 0 }], now);
      if (cue) cueText = cue.text;
    }
    if (r.mode !== "active" && !image) waiting = "Ställ dig så att hela kroppen syns";
    if (cueText && r.voiceOn) speak(cueText, r.voice);
    draw(image, hidden);

    // Uppdatera skärmen högst ~8 gånger/s (eller direkt vid ny instruktion).
    if (cueText || countdown !== null || now - r.lastUi > 120) {
      r.lastUi = now;
      const s = r.session;
      const fps = r.frames.length;
      setLive((l) => ({
        reps: s.reps,
        good: s.goodReps,
        holdS: Math.floor(s.holdMs / 1000),
        phase: phaseLabel || l.phase,
        cue: cueText ?? (hidden && r.mode === "active" ? NOT_VISIBLE : r.mode === "active" ? l.cue : null),
        hidden: hidden && r.mode === "active",
        fps,
        countdown,
        waiting,
        debug: debug ?? l.debug,
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

  function startRecording() {
    if (!run.current) return;
    run.current.rec = { start: performance.now(), frames: [] };
    setRecStatus("recording");
  }

  async function saveRecording() {
    const r = run.current;
    if (!r?.rec) return;
    const { frames, start } = r.rec;
    r.rec = null;
    setRecStatus("saving");
    const secs = (frames.at(-1)?.t ?? 1) / 1000;
    const { error } = await supabaseBrowser().from("pose_recordings").insert({
      movement_key: movementKey,
      fps: Math.round((frames.length / secs) * 10) / 10,
      landmarks: REC_LANDMARKS,
      frames,
      note: `${r.model}, ${new Date(Date.now() - (performance.now() - start)).toISOString()}`,
    });
    setRecStatus(error ? "error" : "saved");
  }

  function toggleVoice() {
    const on = !voiceOn;
    setVoiceOn(on);
    if (run.current) run.current.voiceOn = on;
    saveSettings({ ...loadSettings(), voice: on });
    if (on) speak("Ljud på", run.current?.voice ?? bestSwedishVoice(loadSettings().voiceName));
    else if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
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
    run.current = null; // modellen behålls till nästa set
    setSummary(null);
    setSaved(null);
    setLive(EMPTY_LIVE);
    setPhase("setup");
  }

  // --- Vy ---------------------------------------------------------------------------------
  const showCamera = phase === "live" || phase === "loading";
  return (
    <main className="pt-3">
      {!showCamera && (
        <header className="mb-4 flex items-center gap-3">
          <Link href="/kamera" className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Tillbaka"><CaretLeft size={22} weight="bold" /></Link>
          <h1 className="h-detail">{rule.name}</h1>
        </header>
      )}

      {(phase === "setup" || phase === "error") && (
        <section className="space-y-4">
          <div className="card space-y-2 text-sm">
            <p className="font-medium">Uppställning</p>
            <p className="text-muted-foreground">{rule.setup}</p>
            <p className="text-muted-foreground">
              Kameran bedömer: {Object.values(rule.faultLabels).join(", ").toLowerCase()}. Ingen bild sparas.
            </p>
          </div>
          {!hold && movementKey !== "pushup" && (
            <div className="card">
              <label className="label" htmlFor="w">Vikt (kg, 0 = kroppsvikt)</label>
              <Input id="w" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} className="text-lg" />
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button onClick={() => start()} size="lg" className="w-full">Starta kameran</Button>
        </section>
      )}

      {phase === "paused" && (
        <section className="card space-y-3 text-center">
          <p>Kameran stängdes när du lämnade appen.</p>
          <Button onClick={() => start(true)} className="w-full">Fortsätt</Button>
          <Button onClick={finish} variant="secondary" className="w-full">Avsluta och spara</Button>
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
          <div className="flex items-start gap-3">
            <div className="text-right text-xs text-white/60">
              <p>{live.phase}</p>
              <p>{live.fps} fps</p>
            </div>
            <button
              onClick={() => setShowDebug((d) => !d)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl"
              aria-label="Visa mätvärden"
            >
              📊
            </button>
            <button
              onClick={toggleVoice}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl"
              aria-label={voiceOn ? "Stäng av ljud" : "Slå på ljud"}
            >
              {voiceOn ? "🔊" : "🔇"}
            </button>
          </div>
        </div>

        {showDebug && (
          <div className="absolute left-4 top-36 space-y-2 rounded-xl bg-black/70 p-3 text-xs text-white tabular-nums">
            {live.debug ? (
              Object.entries(live.debug).map(([k, v]) => (
                <p key={k} className="flex justify-between gap-4"><span className="text-white/60">{k}</span><span>{v}</span></p>
              ))
            ) : (
              <p className="text-white/60">Mätvärden visas när räkningen startat.</p>
            )}
            <button
              onClick={recStatus === "recording" ? saveRecording : startRecording}
              disabled={recStatus === "saving"}
              className="mt-1 w-full rounded-lg bg-white/15 px-3 py-2 text-sm"
            >
              {recStatus === "recording" ? "⏹ Stoppa och spara" : recStatus === "saving" ? "Sparar…" : "⏺ Spela in mätdata (30 s)"}
            </button>
            {recStatus === "saved" && <p className="text-brand">✓ Inspelning sparad</p>}
            {recStatus === "error" && <p className="text-danger">Kunde inte spara</p>}
          </div>
        )}

        {phase === "loading" && (
          <p className="absolute inset-x-0 top-1/2 text-center text-white/80">Startar kamera och modell…</p>
        )}

        {phase === "live" && live.countdown !== null && (
          <p className="absolute inset-x-0 top-1/3 text-center text-[7rem] font-bold leading-none text-white drop-shadow-lg tabular-nums">
            {live.countdown}
          </p>
        )}
        {phase === "live" && live.countdown === null && live.waiting && (
          <div className="absolute inset-x-4 top-1/3 flex justify-center">
            <p className="rounded-2xl bg-black/75 px-5 py-3 text-center text-xl font-semibold text-white">{live.waiting}</p>
          </div>
        )}
        {live.cue && phase === "live" && live.countdown === null && !live.waiting && (
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
          <Button onClick={finish} size="lg" className="w-full">Klar</Button>
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
              <p className="text-sm text-muted-foreground">Inget registrerades. Kontrollera att hela kroppen syns och försök igen.</p>
            ) : summary.topFaults.length === 0 ? (
              <p className="text-sm text-brand">Inga fel upptäcktes – snyggt!</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {summary.topFaults.map((f) => (
                  <li key={f.key} className="flex justify-between">
                    <span>{f.label}</span>
                    <span className="text-muted-foreground">{hold ? `${f.count} s` : `${f.count} av ${summary.reps}`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {saved?.ok && (
            <Link href={`/gym/${saved.sessionId}`} className="card block text-sm text-brand">✓ Sparat i gymloggen – visa passet →</Link>
          )}
          {saved && !saved.ok && <p className="card text-sm text-muted-foreground">{saved.error}</p>}
          <Button onClick={again} className="w-full">Nytt set</Button>
          <Button asChild variant="secondary" className="w-full"><Link href="/kamera">Byt övning</Link></Button>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
