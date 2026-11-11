"use client";
import { useEffect, useSyncExternalStore } from "react";
import confetti from "canvas-confetti";
import { Target, Trophy } from "@phosphor-icons/react/dist/ssr";
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Medal } from "./Medal";

export type CelebrationEvent = { key: string; kind: "milestone" | "record" | "rings"; title: string; text: string; medalText?: string };

const STORE = "firat";
const EVT = "firat";

function seen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "[]");
  } catch {
    return [];
  }
}
function markSeen(key: string) {
  try {
    localStorage.setItem(STORE, JSON.stringify([...seen(), key].slice(-200)));
  } catch {}
  window.dispatchEvent(new Event(EVT));
}
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  return () => window.removeEventListener(EVT, cb);
};

function colors() {
  const css = getComputedStyle(document.documentElement);
  return ["--primary", "--primary-2", "--run", "--gym", "--streak"].map((v) => css.getPropertyValue(v).trim()).filter(Boolean);
}

/** Firar nya rekord, milstolpar och stängda ringar – en gång per händelse (sparas i webbläsaren). */
export function Celebrate({ events }: { events: CelebrationEvent[] }) {
  const currentKey = useSyncExternalStore(
    subscribe,
    () => events.find((e) => !seen().includes(e.key))?.key ?? null,
    () => null,
  );
  const current = events.find((e) => e.key === currentKey) ?? null;

  useEffect(() => {
    if (!current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = colors();
    const shoot = (x: number, angle: number) =>
      confetti({ particleCount: 70, spread: 65, angle, startVelocity: 48, origin: { x, y: 0.7 }, colors: c, scalar: 0.9, ticks: 220, zIndex: 100, disableForReducedMotion: true });
    shoot(0.1, 60);
    shoot(0.9, 120);
    const t = setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.35 }, colors: c, zIndex: 100, disableForReducedMotion: true }), 350);
    return () => clearTimeout(t);
  }, [current]);

  if (!current) return null;
  return (
    <AlertDialog open onOpenChange={(o) => !o && markSeen(current.key)}>
      <AlertDialogContent size="sm" className="items-center text-center">
        <div className="celebrate-pop mx-auto flex justify-center pt-2">
          {current.kind === "milestone" ? (
            <Medal id="celebrate-medal" size={96} text={current.medalText} />
          ) : (
            <span className={`flex size-24 items-center justify-center rounded-full ${current.kind === "record" ? "bg-gym/15 text-gym" : "bg-brand/15 text-brand"}`}>
              {current.kind === "record" ? <Trophy size={56} weight="duotone" /> : <Target size={56} weight="duotone" />}
            </span>
          )}
        </div>
        <AlertDialogTitle className="text-center text-xl font-extrabold tracking-tight">{current.title}</AlertDialogTitle>
        <AlertDialogDescription className="text-center text-base">{current.text}</AlertDialogDescription>
        <AlertDialogAction className="mt-2 w-full" onClick={() => markSeen(current.key)}>
          Snyggt!
        </AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}
