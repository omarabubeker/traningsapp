"use client";
import { useSyncExternalStore } from "react";

// Ljust/mörkt läge. Valet sparas i webbläsaren ("auto" följer telefonen).
export type ThemePref = "auto" | "light" | "dark";
export const THEME_KEY = "tema";
export const THEME_COLORS = { light: "#f2f3ef", dark: "#0a0b0a" } as const;

/** Körs i <head> före första målningen, så att sidan aldrig blinkar i fel läge. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}")||"auto";var d=t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export function readPref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}

export function applyTheme(pref: ThemePref = readPref()) {
  const dark = pref === "dark" || (pref === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", dark ? THEME_COLORS.dark : THEME_COLORS.light));
}

export function setPref(pref: ThemePref) {
  try {
    if (pref === "auto") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {}
  applyTheme(pref);
  window.dispatchEvent(new Event("tema"));
}

/** Det sparade valet (uppdateras när det ändras). */
export function usePref(): ThemePref {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("tema", cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener("tema", cb);
        window.removeEventListener("storage", cb);
      };
    },
    readPref,
    () => "auto",
  );
}

/** true när appen visas i mörkt läge (följer klassen på <html>). */
export function useIsDark() {
  return useSyncExternalStore(
    (cb) => {
      const o = new MutationObserver(cb);
      o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return () => o.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}
