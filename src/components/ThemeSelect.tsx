"use client";
import { Moon, Sun, CircleHalf } from "@phosphor-icons/react/dist/ssr";
import { setPref, usePref, type ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "auto", label: "Automatiskt", Icon: CircleHalf },
  { value: "light", label: "Ljust", Icon: Sun },
  { value: "dark", label: "Mörkt", Icon: Moon },
];

/** Val av ljust/mörkt läge (sparas i den här webbläsaren). */
export function ThemeSelect() {
  const pref = usePref();
  return (
    <div role="radiogroup" aria-label="Utseende" className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1">
      {OPTIONS.map(({ value, label, Icon }) => {
        const on = pref === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={on}
            onClick={() => setPref(value)}
            className={`flex h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold transition ${on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <Icon size={18} weight={on ? "fill" : "regular"} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
