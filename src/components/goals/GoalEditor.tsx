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
import { Barbell, PersonSimpleRun, Target } from "@phosphor-icons/react/dist/ssr";

export type Mode = { type: "edit"; goal: Goal } | { type: "new-primary"; replaces?: Goal | null } | { type: "new-sub" };

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-2 text-sm font-semibold transition ${on ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`;

/** Bottenark för att sätta eller ändra ett mål (lopp eller allmänt). */
export function GoalEditor({ mode, trigger }: { mode: Mode; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const heading = mode.type === "edit" ? "Ändra mål" : mode.type === "new-sub" ? "Nytt delmål" : "Nytt mål";
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-base">{heading}</DrawerTitle>
          <DrawerDescription className="sr-only">Ange mål, datum och måltid</DrawerDescription>
        </DrawerHeader>
        <div className="pb-safe mx-auto w-full max-w-md overflow-y-auto px-4">
          <GoalForm mode={mode} onSaved={() => setOpen(false)} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

type Focus = "run" | "strength" | "general";
const FOCUS: { v: Focus; label: string; hint: string; Icon: typeof PersonSimpleRun }[] = [
  { v: "run", label: "Springa ett lopp", hint: "Distans, datum och måltid", Icon: PersonSimpleRun },
  { v: "strength", label: "Bli starkare", hint: "T.ex. knäböj 100 kg", Icon: Barbell },
  { v: "general", label: "Annat mål", hint: "T.ex. träna regelbundet", Icon: Target },
];
const LIFTS = ["Knäböj", "Marklyft", "Bänkpress"];

/** Själva målformuläret (används i arket ovan och i introduktionen). */
export function GoalForm({ mode, onSaved, submitLabel = "Spara" }: { mode: Mode; onSaved?: () => void; submitLabel?: string }) {
  const router = useRouter();
  const g = mode.type === "edit" ? mode.goal : null;
  const initialFocus: Focus | null = mode.type === "new-sub" ? "general" : g ? (g.focus ?? (g.kind === "race" ? "run" : "general")) : null;
  const [focus, setFocus] = useState<Focus | null>(initialFocus);
  const [km, setKm] = useState<number | null>(g?.distance_km ?? 42.195);
  const [customKm, setCustomKm] = useState(g?.distance_km && !DISTANCES.some((d) => Math.abs(d.km - g.distance_km!) < 0.05) ? String(g.distance_km).replace(".", ",") : "");
  const [title, setTitle] = useState(g?.title ?? "");
  const [date, setDate] = useState(g?.race_date ?? "");
  const [time, setTime] = useState(g?.target_time_s ? formatTime(g.target_time_s) : "");
  const [lift, setLift] = useState(g?.exercise ?? "Knäböj");
  const [customLift, setCustomLift] = useState(g?.exercise && !LIFTS.includes(g.exercise) ? g.exercise : "");
  const [kg, setKg] = useState(g?.target_kg ? String(g.target_kg).replace(".", ",") : "");
  const [start, setStart] = useState(g?.start_date ?? isoDay());
  const [notes, setNotes] = useState(g?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const distance = customKm ? Number(customKm.replace(",", ".")) || null : km;
  const target = time.trim() ? parseTime(time) : null;
  const pace = focus === "run" && distance && target ? goalPace({ distance_km: distance, target_time_s: target }) : null;
  const exercise = (customLift.trim() || lift).trim();
  const targetKg = Number(kg.replace(",", ".")) || null;

  function pickFocus(f: Focus) {
    setFocus(f);
    if (!title) setTitle(f === "run" ? distanceLabel(km ?? 42.195) : "");
  }
  function pickDistance(d: number | null) {
    setKm(d);
    setCustomKm("");
    if (d && (!title || DISTANCES.some((x) => x.label === title))) setTitle(distanceLabel(d));
  }

  async function save() {
    if (!focus) return;
    const autoTitle = focus === "strength" ? `${exercise} ${kg.trim()} kg` : title.trim();
    if (!autoTitle.trim() || (focus === "strength" && (!exercise || !targetKg))) return toast.error(focus === "strength" ? "Välj övning och målvikt." : "Ge målet ett namn.");
    if (focus === "run" && (!distance || !date)) return toast.error("Välj distans och datum för loppet.");
    if (focus === "run" && time.trim() && !target) return toast.error("Skriv måltiden som t.ex. 3:59:59 eller 52:30.");
    setBusy(true);
    const sb = supabaseBrowser();
    const row = {
      kind: focus === "run" ? ("race" as const) : ("general" as const),
      focus,
      title: autoTitle.slice(0, 80),
      distance_km: focus === "run" ? distance : null,
      race_date: date || null,
      target_time_s: focus === "run" ? target : null,
      exercise: focus === "strength" ? exercise : null,
      target_kg: focus === "strength" ? targetKg : null,
      start_date: start,
      notes: focus === "general" ? notes.trim() || null : null,
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
    router.refresh();
    onSaved?.();
  }

  // Första valet: vilken sorts mål
  if (!focus)
    return (
      <div className="space-y-3">
        {FOCUS.map(({ v, label, hint, Icon }) => (
          <button key={v} type="button" onClick={() => pickFocus(v)} className="card flex w-full items-center gap-4 text-left active:bg-secondary">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
              <Icon size={26} weight="duotone" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-bold">{label}</span>
              <span className="block text-sm text-muted-foreground">{hint}</span>
            </span>
          </button>
        ))}
      </div>
    );

  return (
    <div className="space-y-5">
      {mode.type !== "new-sub" && (
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1">
          {FOCUS.map(({ v }) => (
            <button key={v} type="button" onClick={() => pickFocus(v)} className={`h-10 rounded-xl text-sm font-semibold ${focus === v ? "bg-card shadow-sm" : "text-muted-foreground"}`}>
              {v === "run" ? "Lopp" : v === "strength" ? "Styrka" : "Annat"}
            </button>
          ))}
        </div>
      )}

      {focus === "run" && (
        <>
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
          <div>
            <label className="label" htmlFor="goal-title">Namn på loppet</label>
            <Input id="goal-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="T.ex. Stockholm Marathon" />
          </div>
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
        </>
      )}

      {focus === "strength" && (
        <>
          <div className="space-y-2">
            <p className="label">Övning</p>
            <div className="flex flex-wrap gap-2">
              {LIFTS.map((l) => (
                <button key={l} type="button" className={chip(!customLift && lift === l)} onClick={() => { setLift(l); setCustomLift(""); }}>
                  {l}
                </button>
              ))}
            </div>
            <Input placeholder="Annan övning" value={customLift} maxLength={60} onChange={(e) => setCustomLift(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="goal-kg">Målvikt (kg)</label>
              <Input id="goal-kg" inputMode="decimal" placeholder="100" value={kg} onChange={(e) => setKg(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="goal-date">Klart till (valfritt)</label>
              <Input id="goal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted-foreground">Räknas som ett lyft (1RM) – uppskattat från dina set, så du behöver inte maxtesta.</p>
        </>
      )}

      {focus === "general" && (
        <>
          <div>
            <label className="label" htmlFor="goal-title">Mål</label>
            <Input id="goal-title" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="T.ex. Träna tre gånger i veckan" />
          </div>
          <div>
            <label className="label" htmlFor="goal-notes">Beskrivning (valfri)</label>
            <Textarea id="goal-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="T.ex. hela våren, minst ett styrkepass" />
          </div>
          {mode.type !== "new-sub" && (
            <div>
              <label className="label" htmlFor="goal-date">Klart till (valfritt)</label>
              <Input id="goal-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          )}
        </>
      )}

      {mode.type !== "new-sub" && (
        <div>
          <label className="label" htmlFor="goal-start">Startdatum</label>
          <Input id="goal-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <p className="mt-1 text-xs text-muted-foreground">Milstolparna räknas från det här datumet.</p>
        </div>
      )}

      <Button className="w-full" onClick={save} disabled={busy}>{busy ? "Sparar…" : submitLabel}</Button>
    </div>
  );
}
