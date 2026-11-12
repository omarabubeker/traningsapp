"use client";
import { useState } from "react";
import Link from "next/link";
import { Barbell, CaretRight, CheckCircle, Lightning, Moon, PersonSimpleRun } from "@phosphor-icons/react/dist/ssr";
import { PlanItemCard } from "@/components/PlanItemCard";
import type { PlanItemWithStatus } from "@/lib/coach/planData";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";

type Target = { distance_km?: number | null; duration_min?: number | null; intensity?: string | null; exercises?: unknown[] };

function facts(it: PlanItemWithStatus) {
  const t = (it.target ?? {}) as Target;
  return [
    t.distance_km ? { v: t.distance_km.toLocaleString("sv-SE"), u: "km" } : null,
    t.duration_min ? { v: String(t.duration_min), u: "min" } : null,
    t.exercises?.length ? { v: String(t.exercises.length), u: t.exercises.length === 1 ? "övning" : "övningar" } : null,
  ].filter((x): x is { v: string; u: string } => !!x);
}

const KIND_ICON = { run: PersonSimpleRun, gym: Barbell, other: Lightning, rest: Moon } as const;

/** Dagens pass som hjältekort i accentfärgen; tryck för detaljer i ett bottenark. */
export function TodayHero({ items, order }: { items: PlanItemWithStatus[]; order: Record<string, string> }) {
  const [open, setOpen] = useState<PlanItemWithStatus | null>(null);
  return (
    <>
      <div className="space-y-3">
        {items.map((it) => {
          const Icon = KIND_ICON[it.kind];
          const done = it.status === "done";
          const rest = it.kind === "rest";
          const t = (it.target ?? {}) as Target;
          return (
            <button
              key={it.id}
              onClick={() => setOpen(it)}
              className={`relative block w-full overflow-hidden rounded-[22px] p-5 text-left transition active:scale-[0.99] ${
                rest ? "border border-border bg-card text-card-foreground" : "hero-gradient text-primary-foreground"
              }`}
            >
              <span className="flex items-center justify-between text-[13px] font-bold uppercase tracking-wider opacity-80">
                <span className="flex items-center gap-1.5">
                  <Icon size={16} weight="bold" />
                  {rest ? "Vilodag" : "Idag"}
                </span>
                <span className="flex items-center gap-1">
                  {done ? (
                    <>
                      <CheckCircle size={16} weight="fill" /> Klart
                    </>
                  ) : (
                    order[it.id]
                  )}
                </span>
              </span>
              <span className="mt-3 block text-[1.625rem] font-extrabold leading-tight tracking-tight">{it.title}</span>
              {!rest && (facts(it).length > 0 || t.intensity) && (
                <span className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
                  {facts(it).map((f) => (
                    <span key={f.u} className="num-lg">
                      {f.v}
                      <span className="ml-1 text-xs font-bold uppercase opacity-70">{f.u}</span>
                    </span>
                  ))}
                  {t.intensity && <span className="min-w-0 truncate text-sm font-semibold opacity-80">{t.intensity}</span>}
                </span>
              )}
              {rest && it.description && <span className="mt-1 block text-sm text-muted-foreground">{it.description}</span>}
              <CaretRight size={16} weight="bold" className="absolute right-5 bottom-5 opacity-60" />
            </button>
          );
        })}
      </div>
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-base">Dagens pass</DrawerTitle>
            <DrawerDescription className="sr-only">Detaljer för dagens planerade pass</DrawerDescription>
          </DrawerHeader>
          {open && (
            <div className="pb-safe mx-auto w-full max-w-md space-y-4 overflow-y-auto px-4">
              <PlanItemCard item={open} status={open.status} doneDay={open.doneDay} showDate={false} today={open.date} />
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
