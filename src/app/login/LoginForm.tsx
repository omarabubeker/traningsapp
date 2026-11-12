"use client";
import { useActionState, useState } from "react";
import { signIn, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const linkToken = (text: string) => text.trim().match(/(?:\/in\/)?([A-Za-z0-9_-]{32,})\/?$/)?.[1] ?? null;

/** Inloggning med den personliga länken (klistra in), och lösenord som dold reserv. */
export function LoginForm({ notice }: { notice: string | null }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const [link, setLink] = useState("");
  const [showPassword, setShowPassword] = useState(!!state.error);
  const token = linkToken(link);

  return (
    <div className="space-y-8">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          // Full sidladdning: /in/… är en serverväg som sätter inloggningen.
          if (token) window.location.assign(new URL(`/in/${token}`, window.location.origin).toString());
        }}
      >
        <label className="label" htmlFor="link">Din personliga länk</label>
        <Input id="link" autoCapitalize="off" autoCorrect="off" placeholder="Klistra in länken du fick" value={link} onChange={(e) => setLink(e.target.value)} />
        {notice && <p className="text-sm text-danger">{notice}</p>}
        {link.trim() && !token && <p className="text-sm text-muted-foreground">Det ser inte ut som en hel länk – kopiera hela länken från meddelandet.</p>}
        <Button className="w-full" disabled={!token}>Logga in</Button>
        <p className="text-xs text-muted-foreground">Tips: trycker du på länken i meddelandet loggas du in direkt. På iPhone behöver du klistra in den här en gång i appen på hemskärmen.</p>
      </form>

      {showPassword ? (
        <form action={action} className="space-y-4 border-t border-border pt-6">
          <div>
            <label className="label" htmlFor="email">E-post</label>
            <Input id="email" name="email" type="email" required autoComplete="username" inputMode="email" defaultValue={state.email} placeholder="du@exempel.se" />
          </div>
          <div>
            <label className="label" htmlFor="password">Lösenord</label>
            <Input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          {state.error && <p className="text-sm text-danger">{state.error}</p>}
          <Button variant="secondary" className="w-full" disabled={pending}>{pending ? "Loggar in…" : "Logga in med lösenord"}</Button>
        </form>
      ) : (
        <button type="button" onClick={() => setShowPassword(true)} className="w-full text-center text-sm text-muted-foreground">
          Logga in med lösenord
        </button>
      )}
    </div>
  );
}
