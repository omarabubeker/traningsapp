"use client";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { addMember, type ActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddMember() {
  const [state, action, pending] = useActionState<ActionResult, FormData>(addMember, { ok: false });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      form.current?.reset();
      toast.success("Tillagd – skicka länken nedan");
    }
  }, [state]);
  return (
    <form ref={form} action={action} className="card space-y-3">
      <p className="h-card">Bjud in en vän</p>
      <div className="grid gap-3">
        <Input name="name" placeholder="Namn" required maxLength={60} autoComplete="off" />
        <Input name="email" type="email" inputMode="email" placeholder="E-post" required autoComplete="off" />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <Button className="w-full" disabled={pending}>{pending ? "Lägger till…" : "Skapa personlig länk"}</Button>
      <p className="text-xs text-muted-foreground">E-posten används bara som id för kontot – inga mejl skickas.</p>
    </form>
  );
}
