"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ageFrom } from "@/lib/dates";
import type { Profile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ProfileForm({ initial, userId }: { initial: Profile | null; userId: string }) {
  const [p, setP] = useState({
    height_cm: initial?.height_cm?.toString() ?? "",
    birth_date: initial?.birth_date ?? "",
    resting_hr: initial?.resting_hr?.toString() ?? "",
    max_hr: initial?.max_hr?.toString() ?? "",
    goals: initial?.goals ?? "",
    injuries: initial?.injuries ?? "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const set = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setP({ ...p, [k]: e.target.value });
    setStatus("idle");
  };
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  const age = ageFrom(p.birth_date || null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    const { error } = await supabaseBrowser().from("profile").upsert({
      user_id: userId,
      height_cm: num(p.height_cm),
      birth_date: p.birth_date || null,
      resting_hr: num(p.resting_hr),
      max_hr: num(p.max_hr),
      goals: p.goals.trim() || null,
      injuries: p.injuries.trim() || null,
      updated_at: new Date().toISOString(),
    });
    setStatus(error ? "error" : "saved");
  }

  return (
    <form onSubmit={save} className="card space-y-4">
      <h2 className="font-medium">Om mig</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="height">Längd (cm)</label>
          <Input id="height" inputMode="decimal" value={p.height_cm} onChange={set("height_cm")} />
        </div>
        <div>
          <label className="label" htmlFor="birth">Född {age !== null && <span>({age} år)</span>}</label>
          <Input id="birth" type="date" value={p.birth_date} onChange={set("birth_date")} />
        </div>
        <div>
          <label className="label" htmlFor="rhr">Vilopuls</label>
          <Input id="rhr" inputMode="numeric" value={p.resting_hr} onChange={set("resting_hr")} />
        </div>
        <div>
          <label className="label" htmlFor="mhr">Maxpuls</label>
          <Input id="mhr" inputMode="numeric" value={p.max_hr} onChange={set("max_hr")} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="goals">Mål</label>
        <Textarea id="goals" rows={3} placeholder="T.ex. springa 10 km under 50 min i maj, bli starkare i knäböj" value={p.goals} onChange={set("goals")} />
      </div>
      <div>
        <label className="label" htmlFor="inj">Skador och begränsningar</label>
        <Textarea id="inj" rows={3} placeholder="T.ex. känsligt vänsterknä vid djupa böj" value={p.injuries} onChange={set("injuries")} />
      </div>
      <Button className="w-full" disabled={status === "saving"}>
        {status === "saving" ? "Sparar…" : status === "saved" ? "Sparat ✓" : "Spara"}
      </Button>
      {status === "error" && <p className="text-sm text-danger">Kunde inte spara. Kontrollera värdena och försök igen.</p>}
    </form>
  );
}
