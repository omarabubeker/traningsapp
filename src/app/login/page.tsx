"use client";
import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl font-semibold">Träning</h1>
      <p className="mb-8 text-muted-foreground">Logga in för att fortsätta.</p>

      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">E-post</label>
          <Input
            id="email" name="email" type="email" required autoComplete="username" inputMode="email"
            defaultValue={state.email} placeholder="du@exempel.se"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Lösenord</label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button className="w-full" disabled={pending}>
          {pending ? "Loggar in…" : "Logga in"}
        </Button>
      </form>
    </main>
  );
}
