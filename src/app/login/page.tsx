"use client";
import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl font-semibold">Träning</h1>
      <p className="mb-8 text-muted">Logga in för att fortsätta.</p>

      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">E-post</label>
          <input
            id="email" name="email" type="email" required autoComplete="username" inputMode="email"
            defaultValue={state.email} className="field" placeholder="du@exempel.se"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">Lösenord</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
        </div>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Loggar in…" : "Logga in"}
        </button>
      </form>
    </main>
  );
}
