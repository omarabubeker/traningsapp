"use client";
import { useMemo, useState } from "react";
import type { Exercise } from "@/lib/types";
import { Input } from "@/components/ui/input";

type Props = {
  exercises: Exercise[];
  onPick: (id: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
};

export function ExercisePicker({ exercises, onPick, onCreate, onClose }: Props) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? exercises.filter((e) => e.name.toLowerCase().includes(s)) : exercises;
  }, [q, exercises]);
  const exact = exercises.some((e) => e.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className="pt-safe mx-auto flex w-full max-w-md items-center gap-2 px-4 pb-3">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Sök eller skapa övning"
         
        />
        <button onClick={onClose} className="px-2 py-3 text-muted-foreground">Stäng</button>
      </div>
      <ul className="pb-safe mx-auto w-full max-w-md flex-1 overflow-y-auto px-4">
        {q.trim() && !exact && (
          <li>
            <button onClick={() => onCreate(q.trim())} className="w-full rounded-xl px-3 py-4 text-left text-brand active:bg-surface">
              + Skapa ”{q.trim()}”
            </button>
          </li>
        )}
        {filtered.map((e) => (
          <li key={e.id}>
            <button onClick={() => onPick(e.id)} className="flex w-full items-baseline justify-between rounded-xl px-3 py-4 text-left active:bg-surface">
              <span>{e.name}</span>
              <span className="text-xs text-muted-foreground">{e.muscle_group}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
