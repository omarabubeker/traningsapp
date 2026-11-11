"use client";
import { useEffect } from "react";
import { applyTheme, readPref } from "@/lib/theme";

/** Följer telefonens läge när valet är "Automatiskt". */
export function ThemeWatcher() {
  useEffect(() => {
    applyTheme();
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => readPref() === "auto" && applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}
