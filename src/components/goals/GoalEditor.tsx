"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";
import { DISTANCES, distanceLabel, formatTime, goalPace, parseTime, type Goal } from "@/lib/goalDef";
import { formatPace } from "@/lib/running";
import { isoDay } from "@/lib/dates";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Mode = { type: "edit"; goal: Goal } | { type: "new-primary"; replaces?: Goal | null } | { type: "new-sub" };

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-2 text-sm font-semibold transition ${on ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`;

/** Bottenark för att sätta eller ändra ett mål (lopp eller allmänt). */
export function GoalEditor({ mode, trigger }: { mode: Mode; trigger: React.ReactNode }) {
  const router = useRouter();
  const g = mode.type === "edit" ? mode.goal : null;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"race" | "general">(mode.type === "new-sub" ? "general" : (g?.kind ?? "race"));
  const [km, setKm] = useState<number | null>(g?.distance_km ?? 42.195);
  const [customKm, setCustomKm] = useState(g?.distance_km && !DISTANCES.some((d) => Math.abs(d.km - g.distance_km!) < 0.05) ? String(g.distance_km).replace(".", ",") : "");
  const [title, setTitle] = useState(g?.title ?? (mode.type === "new-sub" ? "" : "Maraton"));
  const [date, setDate] = useState(g?.race_date ?? "");
  const [time, setTime] = useState(g?.target_time_s ? formatTime(g.target_time_s) : "");
  const [start, setStart] = useState(g?.start_date ?? isoDay());
  const [notes, setNotes] = useState(g?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const distance = customKm ? Number(customKm.replace(",", ".")) || null : km;
  const target = time.trim() ? parseTime(time) : null;
  const pace = kind === "race" && distance && target ? goalPace({ distance_km: distance, target_time_s: target }) : null;

  function pickDistance(d: number | null) {
    setKm(d);
    setCustomKm("");
    // Föreslå titel efter distans om man inte skrivit en egen
    if (d && (!title || DISTANCES.some((x) => x.label === title))) setTitle(distanceLabel(d));
  }

  async function save() {
    if (!title.trim()) return toast.error("Ge målet ett namn.");
    if (kind === "race" && (!distance || !date)) return toast.error("Välj distans och datum för loppet.");
    if (time.trim() && !target) return toast.error("Skriv måltiden som t.ex. 3:59:59 eller 52:30.");
    setBusy(true);
    const sb = supabaseBrowser();
    const row = {
      kind,
      title: title.trim(),
      distance_km: kind === "race" ? distance : null,
      race_date: kind === "race" ? date : null,
      target_time_s: kind === "race" ? target : null,
      start_date: start,
      notes: notes.trim() || null,
    };
    let error;
    if (mode.type === "edit") {
      ({ error } = await sb.from("goals").update(row).eq("id", mode.goal.id));
    } else if (mode.type === "new-primary") {
      // Det tidigare huvudmålet arkiveras (om det inte redan är avklarat).
      if (mode.replaces && mode.replaces.status === "active") {
        ({ error } = await sb.from("goals").update({ status: "archived", is_primary: false }).eq("id", mode.replaces.id));
      }
      if (!error) ({ error } = await sb.from("goals").insert({ ...row, is_primary: true }));
    } else {
      ({ error } = await sb.from("goals").insert({ ...row, is_primary: false }));
    }
    setBusy(false);
    if (error) return toast.error("Kunde inte spara målet.");
    toast.success(mode.type === "new-sub" ? "Delmålet är tillagt" : "Målet är sparat");
    setOpen(false);
    router.refresh();
  }

  const heading = mode.type === "edit" ? "Ändra mål" : mode.type === "new-sub" ? "Nytt delmål" : "Nytt mål";
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base">{heading}</DrawerTitle>
          <DrawerDescription className="sr-only">Ange mål, datum och måltid</DrawerDescription>
        </DrawerHeader>
        <div className="pb-safe mx-auto w-full max-w-md space-y-5 overflow-y-auto px-4">
          {mode.type !== "new-sub" && (
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1">
              {(["race", "general"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={`h-10 rounded-xl text-sm font-semibold ${kind === k ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
                  {k === "race" ? "Ett lopp" : "Annat mål"}
                </button>
              ))}
            </div>
          )}

          {kind === "race" && (
            <div className="space-y-2">
              <p className="label">Distans</p>
              <div className="flex flex-wrap gap-2">
                {DISTANCES.map((d) => (
                  <button key={d.label} type="button" className={chip(!customKm && km !== null && Math.abs(km - d.km) < 0.05)} onClick={() => pickDistance(d.km)}>
                    {d.label}
                  </button>
                ))}
              </div>
              <Input inputMode="decimal" placeholder="Annan distans (km)" value={customKm} onChange={(e) => setCustomKm(e.target.value)} />
            </div>
          )}

          <div>
            <label className="label" htmlFor="goal-title">{kind === "race" ? "Namn på loppet" : "Mål"}</label>
            <Input id="goal-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "race" ? "T.ex. Stockholm Marathon" : "T.ex. Knäböj 100 kg"} />
          </div>

          {kind === "race" ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="goal-date">Datum</label>
                <Input id="goal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="goal-time">Måltid (valfri)</label>
                <Input id="goal-time" inputMode="numeric" placeholder="3:59:59" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              {pace && <p className="col-span-2 -mt-1 text-sm text-muted-foreground">Det motsvarar {formatPace(pace)}/km i snitt.</p>}
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="goal-notes">Beskrivning (valfri)</label>
              <Textarea id="goal-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="T.ex. tre gympass i veckan fram till sommaren" />
            </div>
          )}

          {mode.type !== "new-sub" && (
            <div>
              <label className="label" htmlFor="goal-start">Uppladdningen startar</label>
              <Input id="goal-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Milstolparna räknas från det här datumet.</p>
            </div>
          )}

          <Button className="w-full" onClick={save} disabled={busy}>{busy ? "Sparar…" : "Spara"}</Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
