"use client";
import { useMemo, useState } from "react";
import type { Exercise } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

type Props = {
  open: boolean;
  exercises: Exercise[];
  onPick: (id: string) => void;
  onCreate: (name: string) => void;
  onClose: () => void;
};

/** Bottenark för att välja eller skapa övning. Dra ner eller tryck utanför för att stänga. */
export function ExercisePicker({ open, exercises, onPick, onCreate, onClose }: Props) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? exercises.filter((e) => e.name.toLowerCase().includes(s)) : exercises;
  }, [q, exercises]);
  const exact = exercises.some((e) => e.name.toLowerCase() === q.trim().toLowerCase());

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setQ("");
        }
      }}
    >
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:h-[85dvh] data-[vaul-drawer-direction=bottom]:max-h-[85dvh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-base">Välj övning</DrawerTitle>
          <DrawerDescription className="sr-only">Sök bland dina övningar eller skapa en ny.</DrawerDescription>
        </DrawerHeader>
        <div className="mx-auto w-full max-w-md px-4 pb-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Sök eller skapa övning" />
        </div>
        <ul className="pb-safe mx-auto w-full max-w-md flex-1 overflow-y-auto px-4">
          {q.trim() && !exact && (
            <li>
              <button onClick={() => onCreate(q.trim())} className="w-full rounded-xl px-3 py-4 text-left text-base text-brand active:bg-surface-2">
                + Skapa ”{q.trim()}”
              </button>
            </li>
          )}
          {filtered.map((e) => (
            <li key={e.id}>
              <button onClick={() => onPick(e.id)} className="flex w-full items-baseline justify-between rounded-xl px-3 py-4 text-left text-base active:bg-surface-2">
                <span>{e.name}</span>
                <span className="text-xs text-muted-foreground">{e.muscle_group}</span>
              </button>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  );
}
