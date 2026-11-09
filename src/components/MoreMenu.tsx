"use client";
import { useEffect, useRef, useState } from "react";

export type MoreItem = { label: string; onSelect: () => void; danger?: boolean };

/** ⋯-meny med åtgärder (t.ex. Radera pass). */
export function MoreMenu({ items }: { items: MoreItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-xl text-muted active:bg-surface-2"
        aria-label="Fler val"
        aria-expanded={open}
      >
        ⋯
      </button>
      {open && (
        <ul className="absolute right-0 top-11 z-50 min-w-44 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
          {items.map((it) => (
            <li key={it.label}>
              <button
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
                className={`w-full px-4 py-3 text-left ${it.danger ? "text-danger" : ""} active:bg-surface-2`}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
