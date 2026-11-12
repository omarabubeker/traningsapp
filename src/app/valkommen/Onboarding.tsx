"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CaretLeft, CheckCircle, HandWaving, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import type { Goal } from "@/lib/goalDef";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoalForm } from "@/components/goals/GoalEditor";
import { WatchConnect, type WatchStatus } from "@/components/WatchConnect";
import { InstallGuide } from "@/components/InstallGuide";

type Props = { userId: string; profile: Profile | null; goal: Goal | null; watch: WatchStatus; again: boolean };

const STEPS = ["Namn", "Mål", "Din träning", "Klockan", "Klart"] as const;

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
    training_focus: profile?.training_focus ?? (goal?.focus === "strength" ? "strength" : goal?.focus === "run" ? "run" : null),
    current_sessions: profile?.current_sessions ?? null,
    current_km: profile?.current_km ?? null,
    sessions_per_week: profile?.sessions_per_week ?? 4,
    gym_access: profile?.gym_access ?? null,
  });
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((x) => ({ ...x, [k]: v }));

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

  const title = ["Välkommen!", "Vad vill du nå?", "Din träning", "Koppla klockan", "Allt är klart!"][step];
  const sub = [
    "Den här appen är din tränare – för styrka, löpning eller båda. Tre snabba frågor, sedan gör coachen din första plan.",
    "Välj det som passar bäst – du kan ändra målet när du vill.",
    "Så att första planen hamnar på rätt nivå.",
    "Passen hämtas automatiskt från klockan via intervals.icu.",
    "Lägg gärna appen på hemskärmen, så öppnas den som en vanlig app.",
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
        <section className="space-y-4">
          <GoalForm mode={goal ? { type: "edit", goal } : { type: "new-primary" }} submitLabel="Spara och fortsätt" onSaved={() => next()} />
          <Button variant="ghost" className="w-full" onClick={() => next()}>Hoppa över – jag sätter ett mål senare</Button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-6">
          <Field label="Vad vill du träna?">
            <Choice options={[{ v: "strength", label: "Styrka" }, { v: "run", label: "Löpning" }, { v: "both", label: "Båda" }]} value={p.training_focus} onChange={(v) => set("training_focus", v)} />
          </Field>
          <Field label="Hur ofta tränar du i dag?">
            <Choice options={[{ v: "0-1", label: "0–1 pass/vecka" }, { v: "2-3", label: "2–3 pass" }, { v: "4+", label: "4 eller fler" }]} value={p.current_sessions} onChange={(v) => set("current_sessions", v)} />
          </Field>
          {(p.training_focus === "run" || p.training_focus === "both") && (
            <Field label="Hur mycket springer du per vecka?">
              <Choice options={[{ v: "0", label: "Inget" }, { v: "1-10", label: "1–10 km" }, { v: "10-25", label: "10–25 km" }, { v: "25-40", label: "25–40 km" }, { v: "40+", label: "Mer än 40 km" }]} value={p.current_km} onChange={(v) => set("current_km", v)} />
            </Field>
          )}
          {(p.training_focus === "strength" || p.training_focus === "both") && (
            <Field label="Var tränar du styrka?">
              <Choice options={[{ v: "fullt", label: "Gym" }, { v: "hemma", label: "Hemma (hantlar)" }, { v: "inget", label: "Kroppsvikt" }]} value={p.gym_access} onChange={(v) => set("gym_access", v)} />
            </Field>
          )}
          <Field label="Hur många pass vill du köra per vecka?">
            <Choice options={[2, 3, 4, 5, 6].map((n) => ({ v: n, label: String(n) }))} value={p.sessions_per_week} onChange={(v) => set("sessions_per_week", v)} />
          </Field>
          <Button
            className="w-full"
            disabled={busy || !p.training_focus}
            onClick={() =>
              next({
                training_focus: p.training_focus,
                current_sessions: p.current_sessions,
                current_km: p.training_focus === "strength" ? null : p.current_km,
                gym_access: p.training_focus === "run" ? null : p.gym_access,
                sessions_per_week: p.sessions_per_week,
              })
            }
          >
            Fortsätt
          </Button>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <div className="card">
            <WatchConnect status={watch} onDone={() => next()} />
          </div>
          <Button variant="ghost" className="w-full" onClick={() => next()}>{watch.source ? "Fortsätt" : "Hoppa över – jag kopplar senare"}</Button>
        </section>
      )}

      {step === 4 && (
        <section className="space-y-4">
          <div className="card">
            <InstallGuide />
          </div>
          <ul className="space-y-2 pt-2 text-[15px]">
            {[goal ? "Mål" : null, "Din träning", watch.source ? "Klockan" : null].filter(Boolean).map((x) => (
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
