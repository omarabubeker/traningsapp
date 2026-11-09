"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MOVEMENT_LIST } from "@/lib/movement/registry";
import { bestSwedishVoice, loadSettings, onVoicesReady, saveSettings, speak, swedishVoices, type CameraSettings } from "@/lib/movement/voice";

const ICON: Record<string, string> = { squat: "🏋️", lunge: "🦵", plank: "🧘", pushup: "💪", deadlift: "🏋️‍♂️" };

export default function KameraPage() {
  const [settings, setSettings] = useState<CameraSettings | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    // Inställningar och röster finns bara i webbläsaren.
    const s = loadSettings();
    const off = onVoicesReady(() => setVoices(swedishVoices()));
    queueMicrotask(() => setSettings(s));
    return off;
  }, []);

  function update(p: Partial<CameraSettings>) {
    const next = { ...settings!, ...p };
    setSettings(next);
    saveSettings(next);
  }

  const best = bestSwedishVoice(null);

  return (
    <main className="space-y-5 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/gym" className="-ml-2 px-2 py-2 text-muted" aria-label="Tillbaka">←</Link>
        <div>
          <h1 className="text-2xl font-semibold">Teknik med kamera</h1>
          <p className="text-xs text-muted">Allt analyseras i telefonen. Ingen bild eller video sparas eller skickas.</p>
        </div>
      </header>

      <section className="space-y-2">
        {MOVEMENT_LIST.map((m) => (
          <Link key={m.key} href={`/kamera/${m.key}`} className="card flex items-start gap-3">
            <span className="text-2xl" aria-hidden>{ICON[m.key]}</span>
            <span className="flex-1">
              <span className="block font-medium">{m.name}</span>
              <span className="block text-sm text-muted">{m.setup}</span>
            </span>
            <span className="text-muted">→</span>
          </Link>
        ))}
      </section>

      {settings && (
        <section className="card space-y-4">
          <h2 className="font-medium">Inställningar</h2>
          <label className="flex items-center justify-between gap-3">
            <span>Röstfeedback</span>
            <input type="checkbox" checked={settings.voice} onChange={(e) => update({ voice: e.target.checked })} className="h-6 w-6 accent-[var(--color-accent)]" />
          </label>
          {settings.voice && (
            <div className="space-y-2">
              <label className="label" htmlFor="voice">Röst</label>
              <select id="voice" className="field" value={settings.voiceName ?? ""} onChange={(e) => update({ voiceName: e.target.value || null })}>
                <option value="">Automatiskt{best ? ` (${best.name})` : ""}</option>
                {voices.map((v) => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
              {voices.length === 0 && <p className="text-xs text-muted">Hittar ingen svensk röst. På iPhone: Inställningar → Hjälpmedel → Uppläst innehåll → Röster → Svenska och ladda ner en ”Förbättrad” röst.</p>}
              <button type="button" className="btn-ghost w-full" onClick={() => speak("Tryck ut knäna", bestSwedishVoice(settings.voiceName))}>Testa rösten</button>
            </div>
          )}
          <div>
            <label className="label" htmlFor="model">Modell</label>
            <select id="model" className="field" value={settings.model} onChange={(e) => update({ model: e.target.value as CameraSettings["model"] })}>
              <option value="lite">Snabb (rekommenderas)</option>
              <option value="full">Noggrann (kräver snabbare telefon)</option>
            </select>
          </div>
        </section>
      )}
    </main>
  );
}
