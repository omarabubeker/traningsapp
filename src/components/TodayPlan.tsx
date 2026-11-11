"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { PlanItemCard } from "@/components/PlanItemCard";
import { STATUS_LABEL } from "@/lib/coach/plan";
import type { PlanItemWithStatus } from "@/lib/coach/planData";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

const DOT = { run: "bg-run", gym: "bg-gym", rest: "bg-line", other: "bg-muted-foreground" } as const;

function short(it: PlanItemWithStatus) {
  const t = (it.target ?? {}) as { distance_km?: number | null; duration_min?: number | null };
  if (t.distance_km) return `${t.distance_km.toLocaleString("sv-SE")} km`;
  if (t.duration_min) return `${t.duration_min} min`;
  return null;
}

/** Dagens pass i kompakt form; tryck för detaljerna i ett bottenark. */
export function TodayPlan({ items }: { items: PlanItemWithStatus[] }) {
  const [open, setOpen] = useState<PlanItemWithStatus | null>(null);
  return (
    <>
      <ul className="card divide-y divide-border p-0">
        {items.map((it) => {
          const done = it.status === "done";
          return (
            <li key={it.id}>
              <button onClick={() => setOpen(it)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-surface-2">
                <span className={`size-2.5 shrink-0 rounded-full ${DOT[it.kind]}`} />
                <span className={`min-w-0 flex-1 truncate font-medium ${done ? "text-muted-foreground line-through decoration-1" : ""}`}>{it.title}</span>
                {short(it) && <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{short(it)}</span>}
                {done && <span className="shrink-0 text-sm text-brand">✓</span>}
                {it.kind === "rest" && <span className="shrink-0 text-sm text-muted-foreground">{STATUS_LABEL.rest}</span>}
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          );
        })}
      </ul>
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base">Dagens pass</DrawerTitle>
            <DrawerDescription className="sr-only">Detaljer för dagens planerade pass</DrawerDescription>
          </DrawerHeader>
          {open && (
            <div className="pb-safe mx-auto w-full max-w-md space-y-4 overflow-y-auto px-4">
              <PlanItemCard item={open} status={open.status} doneDay={open.doneDay} showDate={false} />
              <Button asChild variant="secondary" className="w-full">
                <Link href="/plan" onClick={() => setOpen(null)}>Hela veckans plan</Link>
              </Button>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
