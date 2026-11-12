"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CaretLeft, CheckCircle, HandWaving, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isoDay } from "@/lib/dates";
import type { Profile } from "@/lib/types";
import type { Goal } from "@/lib/goalDef";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { GoalForm } from "@/components/goals/GoalEditor";
import { WatchConnect, type WatchStatus } from "@/components/WatchConnect";
import { InstallGuide } from "@/components/InstallGuide";

type Props = { userId: string; profile: Profile | null; goal: Goal | null; watch: WatchStatus; again: boolean };

const STEPS = ["Namn", "Om dig", "Utgångsläge", "Mål", "Din vecka", "Skador", "Klockan", "Hemskärmen", "Klart"] as const;
const DAYS = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

const chip = (on: boolean) =>
  `rounded-full border px-4 py-2.5 text-[15px] font-semibold transition ${on ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`;

function Choice<T extends string | number>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T | null | undefined; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={String(o.v)} type="button" className={chip(value === o.v)} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="label">{label}</p>
      {children}
    </div>
  );
}

/** Introduktionen för nya användare: en fråga per skärm, sparas efter varje steg. */
export function Onboarding({ userId, profile, goal, watch, again }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState({
    display_name: profile?.display_name ?? "",
    birth_date: profile?.birth_date ?? "",
    height_cm: profile?.height_cm?.toString() ?? "",
    weight: "",
    resting_hr: profile?.resting_hr?.toString() ?? "",
    max_hr: profile?.max_hr?.toString() ?? "",
    current_sessions: profile?.current_sessions ?? null,
    current_km: profile?.current_km ?? null,
    gym_experience: profile?.gym_experience ?? null,
    sessions_per_week: profile?.sessions_per_week ?? 4,
    available_days: profile?.available_days ?? [0, 2, 4, 5],
    gym_access: profile?.gym_access ?? null,
    injuries: profile?.injuries ?? "",
  });
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((x) => ({ ...x, [k]: v }));
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")) || null);

  /** Sparar det som hör till steget och går vidare. */
  async function next(save?: Record<string, unknown>) {
    if (save) {
      setBusy(true);
      const { error } = await supabaseBrowser().from("profile").upsert({ user_id: userId, ...save, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      setBusy(false);
      if (error) return toast.error("Kunde inte spara. Försök igen.");
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo(0, 0);
  }

  async function saveAbout() {
    const w = num(p.weight);
    if (w) await supabaseBrowser().from("weight_entries").upsert({ measured_on: isoDay(), weight_kg: w }, { onConflict: "user_id,measured_on" });
    await next({ birth_date: p.birth_date || null, height_cm: num(p.height_cm), resting_hr: num(p.resting_hr), max_hr: num(p.max_hr) });
  }

  async function finish(withPlan: boolean) {
    setBusy(true);
    if (!again) await supabaseBrowser().from("profile").upsert({ user_id: userId, onboarded_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (withPlan) {
      const res = await fetch("/api/coach/weekly", { method: "POST", body: JSON.stringify({ first: true }) });
      if (!res.ok) toast.error("Planen kunde inte skapas just nu – gör en veckoavstämning under Coach senare.");
      else toast.success("Din första plan är klar!");
    }
    router.push("/");
    router.refresh();
  }

  const title = [
    "Välkommen!",
    "Lite om dig",
    "Var står du i dag?",
    "Vad vill du nå?",
    "Din vecka",
    "Skador eller begränsningar?",
    "Koppla klockan",
    "Lägg appen på hemskärmen",
    "Allt är klart!",
  ][step];
  const sub = [
    "Den här appen är din tränare för löpning och gym. Vi börjar med några snabba frågor – det tar ett par minuter.",
    "Används för pulszoner och för att coachen ska förstå dig. Allt utom födelsedatum är valfritt.",
    "Så att första planen hamnar på rätt nivå.",
    "Ett lopp med datum och måltid, eller något annat. Du kan ändra målet när du vill.",
    "Coachen planerar efter det här.",
    "Coachen tar hänsyn till det och anpassar passen.",
    "Passen hämtas automatiskt från klockan via intervals.icu.",
    "Då öppnas den som en vanlig app, i helskärm.",
    "Coachen gör nu din första veckoplan utifrån dina svar.",
  ][step];

  return (
    <main className="pt-safe mx-auto min-h-dvh max-w-md space-y-6 px-4 pb-16">
      <header className="space-y-4 pt-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className={`-ml-2 flex size-10 items-center justify-center rounded-full ${step === 0 ? "invisible" : "active:bg-secondary"}`}
            aria-label="Tillbaka"
          >
            <CaretLeft size={22} weight="bold" />
          </button>
          <div className="flex flex-1 gap-1" aria-label={`Steg ${step + 1} av ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-secondary"}`} />
            ))}
          </div>
          {again && (
            <button onClick={() => router.push("/profil")} className="px-2 text-sm font-semibold text-muted-foreground">
              Stäng
            </button>
          )}
        </div>
        {step === 0 && <HandWaving size={44} weight="duotone" className="text-brand" />}
        {step === STEPS.length - 1 && <Sparkle size={44} weight="duotone" className="text-brand" />}
        <div className="space-y-1.5">
          <h1 className="h-page">{title}</h1>
          <p className="text-[15px] text-muted-foreground">{sub}</p>
        </div>
      </header>

      {step === 0 && (
        <section className="space-y-6">
          <Field label="Vad heter du?">
            <Input autoFocus autoComplete="given-name" placeholder="Förnamn" value={p.display_name} onChange={(e) => set("display_name", e.target.value)} />
          </Field>
          <Button className="w-full" disabled={busy || !p.display_name.trim()} onClick={() => next({ display_name: p.display_name.trim() })}>Fortsätt</Button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <Field label="Födelsedatum">
            <Input type="date" value={p.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Längd (cm)">
              <Input inputMode="decimal" value={p.height_cm} onChange={(e) => set("height_cm", e.target.value)} />
            </Field>
            <Field label="Vikt (kg)">
              <Input inputMode="decimal" value={p.weight} onChange={(e) => set("weight", e.target.value)} />
            </Field>
            <Field label="Vilopuls">
              <Input inputMode="numeric" placeholder="vet inte" value={p.resting_hr} onChange={(e) => set("resting_hr", e.target.value)} />
            </Field>
            <Field label="Maxpuls">
              <Input inputMode="numeric" placeholder="vet inte" value={p.max_hr} onChange={(e) => set("max_hr", e.target.value)} />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">Vet du inte pulsen uppskattar coachen den från din ålder och dina pass.</p>
          <Button className="w-full" disabled={busy} onClick={saveAbout}>Fortsätt</Button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <Field label="Hur ofta tränar du i dag?">
            <Choice options={[{ v: "0-1", label: "0–1 pass/vecka" }, { v: "2-3", label: "2–3 pass" }, { v: "4+", label: "4 eller fler" }]} value={p.current_sessions} onChange={(v) => set("current_sessions", v)} />
          </Field>
          <Field label="Hur mycket springer du per vecka?">
            <Choice options={[{ v: "0", label: "Inget" }, { v: "1-10", label: "1–10 km" }, { v: "10-25", label: "10–25 km" }, { v: "25-40", label: "25–40 km" }, { v: "40+", label: "Mer än 40 km" }]} value={p.current_km} onChange={(v) => set("current_km", v)} />
          </Field>
          <Field label="Hur van är du vid gym?">
            <Choice options={[{ v: "ny", label: "Ny" }, { v: "lite", label: "Lite van" }, { v: "van", label: "Van" }]} value={p.gym_experience} onChange={(v) => set("gym_experience", v)} />
          </Field>
          <Button className="w-full" disabled={busy} onClick={() => next({ current_sessions: p.current_sessions, current_km: p.current_km, gym_experience: p.gym_experience })}>Fortsätt</Button>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <GoalForm mode={goal ? { type: "edit", goal } : { type: "new-primary" }} submitLabel="Spara och fortsätt" onSaved={() => next()} />
          <Button variant="ghost" className="w-full" onClick={() => next()}>Hoppa över – jag sätter ett mål senare</Button>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-6">
          <Field label="Hur många pass vill du köra per vecka?">
            <Choice options={[2, 3, 4, 5, 6].map((n) => ({ v: n, label: String(n) }))} value={p.sessions_per_week} onChange={(v) => set("sessions_per_week", v)} />
          </Field>
          <Field label="Vilka dagar brukar fungera?">
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((d, i) => {
                const on = p.available_days.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set("available_days", on ? p.available_days.filter((x) => x !== i) : [...p.available_days, i].sort())}
                    className={`h-11 rounded-xl text-sm font-semibold ${on ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Har du tillgång till gym?">
            <Choice options={[{ v: "fullt", label: "Fullt gym" }, { v: "hemma", label: "Hemma (hantlar)" }, { v: "inget", label: "Inget – kroppsvikt" }]} value={p.gym_access} onChange={(v) => set("gym_access", v)} />
          </Field>
          <Button className="w-full" disabled={busy} onClick={() => next({ sessions_per_week: p.sessions_per_week, available_days: p.available_days, gym_access: p.gym_access })}>Fortsätt</Button>
        </section>
      )}

      {step === 5 && (
        <section className="space-y-4">
          <Textarea rows={3} placeholder="T.ex. känsligt vänsterknä vid djupa böj" value={p.injuries} onChange={(e) => set("injuries", e.target.value)} />
          <Button className="w-full" disabled={busy} onClick={() => next({ injuries: p.injuries.trim() || null })}>{p.injuries.trim() ? "Fortsätt" : "Inga skador – fortsätt"}</Button>
        </section>
      )}

      {step === 6 && (
        <section className="space-y-4">
          <div className="card">
            <WatchConnect status={watch} onDone={() => next()} />
          </div>
          <Button variant="ghost" className="w-full" onClick={() => next()}>{watch.source ? "Fortsätt" : "Hoppa över – jag kopplar senare"}</Button>
        </section>
      )}

      {step === 7 && (
        <section className="space-y-6">
          <div className="card">
            <InstallGuide />
          </div>
          <Button className="w-full" onClick={() => next()}>Fortsätt</Button>
        </section>
      )}

      {step === 8 && (
        <section className="space-y-3">
          <ul className="space-y-2 text-[15px]">
            {["Profil och utgångsläge", "Mål", "Din vecka", watch.source ? "Klockan" : null].filter(Boolean).map((x) => (
              <li key={x} className="flex items-center gap-2"><CheckCircle size={20} weight="fill" className="text-brand" /> {x}</li>
            ))}
          </ul>
          <Button className="w-full" size="lg" disabled={busy} onClick={() => finish(true)}>{busy ? "Coachen planerar din vecka…" : "Skapa min första plan"}</Button>
          <Button variant="ghost" className="w-full" disabled={busy} onClick={() => finish(false)}>Gå till appen utan plan</Button>
        </section>
      )}
    </main>
  );
}
