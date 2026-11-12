"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDots } from "@phosphor-icons/react/dist/ssr";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { formatDate } from "@/lib/dates";

const DAY = 864e5;
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const mondayOf = (d: string) => addDays(d, -((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7));

/** "Flytta": välj en annan dag i samma vecka. Passet flyttas på klockan också om den är kopplad. */
export function MoveItem({ id, date, today, title }: { id: string; date: string; today: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(mondayOf(date), i)).filter((d) => d >= today && d !== date);
  if (!days.length) return null;

  async function move(to: string) {
    setBusy(to);
    const res = await fetch("/api/plan/flytta", { method: "POST", body: JSON.stringify({ id, date: to }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return toast.error(body.error ?? "Kunde inte flytta passet.");
    setOpen(false);
    const day = formatDate(to + "T12:00:00Z", { weekday: "long" });
    toast.success(body.watch ? `Flyttat till ${day} – även på klockan` : `Flyttat till ${day}`);
    router.refresh();
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-brand active:bg-secondary">
          <CalendarDots size={18} weight="duotone" /> Flytta
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base">Flytta passet: {title}</DrawerTitle>
          <DrawerDescription>Välj en ny dag den här veckan.</DrawerDescription>
        </DrawerHeader>
        <div className="pb-safe mx-auto grid w-full max-w-md gap-2 px-4 pb-4">
          {days.map((d) => (
            <button
              key={d}
              type="button"
              disabled={!!busy}
              onClick={() => move(d)}
              className="card flex items-center justify-between py-3.5 text-left font-semibold first-letter:uppercase active:bg-secondary disabled:opacity-60"
            >
              <span className="first-letter:uppercase">{d === today ? "Idag" : formatDate(d + "T12:00:00Z", { weekday: "long", day: "numeric", month: "short" })}</span>
              {busy === d && <span className="text-sm text-muted-foreground">Flyttar…</span>}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
