"use client";
import { useActionState } from "react";
import { sendCode, verifyCode, type LoginState } from "./actions";

export default function LoginPage() {
  const [emailState, emailAction, sending] = useActionState<LoginState, FormData>(sendCode, { step: "email" });
  const [codeState, codeAction, verifying] = useActionState<LoginState, FormData>(verifyCode, { step: "code" });

  const onCodeStep = emailState.step === "code";
  const email = emailState.email ?? "";

  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl font-semibold">Träning</h1>
      <p className="mb-8 text-muted">Logga in med en engångskod.</p>

      {!onCodeStep ? (
        <form action={emailAction} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">E-post</label>
            <input
              id="email" name="email" type="email" required autoComplete="email" inputMode="email"
              defaultValue={email} className="field" placeholder="du@exempel.se"
            />
          </div>
          {emailState.error && <p className="text-sm text-danger">{emailState.error}</p>}
          <button className="btn-primary w-full" disabled={sending}>
            {sending ? "Skickar…" : "Skicka kod"}
          </button>
        </form>
      ) : (
        <form action={codeAction} className="space-y-4">
          <input type="hidden" name="email" value={email} />
          <p className="text-sm text-muted">{emailState.info} <span className="text-text">{email}</span></p>
          <div>
            <label className="label" htmlFor="code">Kod</label>
            <input
              id="code" name="code" required autoFocus autoComplete="one-time-code" inputMode="numeric"
              pattern="[0-9 ]*" maxLength={10} className="field text-center text-2xl tracking-[0.4em]"
              placeholder="••••••"
            />
          </div>
          {codeState.error && <p className="text-sm text-danger">{codeState.error}</p>}
          <button className="btn-primary w-full" disabled={verifying}>
            {verifying ? "Loggar in…" : "Logga in"}
          </button>
          <button type="button" className="w-full py-2 text-sm text-muted" onClick={() => location.reload()}>
            Byt e-post eller skicka ny kod
          </button>
        </form>
      )}
    </main>
  );
}
