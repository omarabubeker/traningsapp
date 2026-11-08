"use client";
// Röstfeedback med webbläsarens talsyntes. Väljer bästa svenska röst på enheten,
// t.ex. en nedladdad "Förbättrad"/"Enhanced"/"Premium"-röst, före standardrösten.

export function swedishVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === "undefined") return [];
  return speechSynthesis.getVoices().filter((v) => /^sv([-_]|$)/i.test(v.lang));
}

function score(v: SpeechSynthesisVoice) {
  let s = 0;
  if (/förbättrad|enhanced|premium|neural|natural/i.test(v.name)) s += 10;
  if (/sv[-_]SE/i.test(v.lang)) s += 3;
  if (v.localService) s += 2;
  if (/compact|eloquence|novelty/i.test(v.name)) s -= 5;
  return s;
}

export function bestSwedishVoice(preferredName?: string | null): SpeechSynthesisVoice | null {
  const voices = swedishVoices();
  if (preferredName) {
    const chosen = voices.find((v) => v.name === preferredName);
    if (chosen) return chosen;
  }
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Rösterna laddas asynkront i vissa webbläsare. */
export function onVoicesReady(cb: () => void) {
  if (typeof speechSynthesis === "undefined") return () => {};
  if (speechSynthesis.getVoices().length) cb();
  speechSynthesis.addEventListener("voiceschanged", cb);
  return () => speechSynthesis.removeEventListener("voiceschanged", cb);
}

export function speak(text: string, voice: SpeechSynthesisVoice | null) {
  if (typeof speechSynthesis === "undefined") return;
  speechSynthesis.cancel(); // en instruktion åt gången
  const u = new SpeechSynthesisUtterance(text);
  u.lang = voice?.lang ?? "sv-SE";
  if (voice) u.voice = voice;
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

export type CameraSettings = { voice: boolean; voiceName: string | null; model: "lite" | "full" };
const KEY = "kamera-installningar";
export function loadSettings(): CameraSettings {
  try {
    return { voice: true, voiceName: null, model: "lite", ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { voice: true, voiceName: null, model: "lite" };
  }
}
export function saveSettings(s: CameraSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
