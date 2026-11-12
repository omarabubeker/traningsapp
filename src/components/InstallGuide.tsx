"use client";
import { useState, useSyncExternalStore } from "react";
import { CheckCircle, DeviceMobile, DotsThreeVertical, Export } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

// Androids installationsruta (beforeinstallprompt) sparas när den dyker upp, så att vi kan visa en egen knapp.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

type Platform = "standalone" | "ios" | "android" | "desktop" | "unknown";
function platform(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (matchMedia("(display-mode: standalone)").matches || nav.standalone) return "standalone";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-[15px]">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand">{n}</span>
      <span className="min-w-0 flex-1 pt-0.5">{children}</span>
    </li>
  );
}

function IosSteps() {
  return (
    <ol className="space-y-4">
      <Step n={1}>
        Tryck på <b>dela-knappen</b> <Export size={18} weight="bold" className="inline align-[-3px]" /> längst ner i Safari.
      </Step>
      <Step n={2}>Scrolla ner och välj <b>Lägg till på hemskärmen</b>.</Step>
      <Step n={3}>Tryck <b>Lägg till</b>. Öppna sedan appen från hemskärmen.</Step>
    </ol>
  );
}

function AndroidSteps({ canPrompt }: { canPrompt: boolean }) {
  return (
    <div className="space-y-4">
      {canPrompt && (
        <Button className="w-full" onClick={() => deferred?.prompt()}>
          Installera appen
        </Button>
      )}
      <ol className="space-y-4">
        <Step n={1}>
          Tryck på menyn <DotsThreeVertical size={18} weight="bold" className="inline align-[-3px]" /> uppe till höger i Chrome.
        </Step>
        <Step n={2}>Välj <b>Installera app</b> eller <b>Lägg till på startskärmen</b>.</Step>
      </ol>
    </div>
  );
}

const tab = (on: boolean) =>
  `flex-1 rounded-full px-3 py-1.5 text-sm font-semibold transition ${on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`;

/** Instruktion för att lägga appen på hemskärmen – visar telefonens egen variant först, men går att växla. */
export function InstallGuide() {
  const p = useSyncExternalStore(subscribe, platform, () => "unknown" as Platform);
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferred, () => false);
  const [pick, setPick] = useState<"ios" | "android" | null>(null);

  if (p === "standalone")
    return (
      <p className="flex items-center gap-2 font-semibold text-brand">
        <CheckCircle size={22} weight="fill" /> Appen ligger redan på hemskärmen.
      </p>
    );
  const view = pick ?? (p === "android" ? "android" : "ios");
  return (
    <div className="space-y-4">
      {(p === "desktop" || p === "unknown") && (
        <p className="flex items-start gap-2 text-[15px] text-muted-foreground">
          <DeviceMobile size={22} weight="duotone" className="shrink-0" />
          Öppna appen på telefonen och lägg den på hemskärmen därifrån – då känns den som en vanlig app.
        </p>
      )}
      <div className="flex rounded-full bg-secondary p-1" role="tablist">
        <button type="button" role="tab" aria-selected={view === "ios"} className={tab(view === "ios")} onClick={() => setPick("ios")}>
          iPhone
        </button>
        <button type="button" role="tab" aria-selected={view === "android"} className={tab(view === "android")} onClick={() => setPick("android")}>
          Android
        </button>
      </div>
      {view === "ios" ? <IosSteps /> : <AndroidSteps canPrompt={canPrompt && p === "android"} />}
    </div>
  );
}
