"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";

export type ChatMessage = { id: string; role: "user" | "assistant"; kind: "chat" | "weekly"; content: string; created_at: string };

const QUICK = ["Trött i dag", "Kändes bra", "Har ont någonstans", "Vad ska jag köra idag?", "Hinner inte dagens pass"];

export function CoachChat({ initial, configured }: { initial: ChatMessage[]; configured: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState(initial);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<null | "chat" | "weekly">(null);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setError(null);
    setBusy("chat");
    const now = new Date().toISOString();
    const replyId = "svar-" + now;
    setMessages((m) => [
      ...m,
      { id: "fraga-" + now, role: "user", kind: "chat", content, created_at: now },
      { id: replyId, role: "assistant", kind: "chat", content: "", created_at: now },
    ]);
    try {
      const res = await fetch("/api/coach/chat", { method: "POST", body: JSON.stringify({ message: content }) });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Kunde inte nå coachen.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => m.map((x) => (x.id === replyId ? { ...x, content: acc } : x)));
      }
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== replyId));
      setError(e instanceof Error ? e.message : "Något gick fel.");
    } finally {
      setBusy(null);
    }
  }

  async function weekly() {
    if (busy) return;
    if (!confirm("Låt coachen gå igenom veckan och planera nästa? (tar en halv till en minut)")) return;
    setBusy("weekly");
    setError(null);
    try {
      const res = await fetch("/api/coach/weekly", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Avstämningen misslyckades.");
      router.push("/plan");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Något gick fel.");
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-[calc(100dvh-6rem)] flex-col pt-4">
      <header className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Coach</h1>
        <div className="flex gap-2">
          <Link href="/plan" className="btn-ghost min-h-10 px-3 text-sm">Plan</Link>
          <Link href="/coach/minne" className="btn-ghost min-h-10 px-3 text-sm">Minne</Link>
        </div>
      </header>

      {!configured && (
        <p className="card mb-3 text-sm text-danger">Coachen är inte kopplad: lägg in ANTHROPIC_API_KEY i Vercel och bygg om.</p>
      )}

      <button onClick={weekly} disabled={!!busy || !configured} className="btn-primary mb-4 w-full">
        {busy === "weekly" ? "Coachen går igenom veckan…" : "Veckoavstämning"}
      </button>

      <section className="flex-1 space-y-3 pb-40">
        {messages.length === 0 && (
          <p className="card text-sm text-muted">
            Fråga coachen om din träning, berätta hur du mår, eller tryck på Veckoavstämning för att få nästa veckas plan.
          </p>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-10 rounded-2xl rounded-br-md bg-accent/15 px-4 py-2.5 text-right">
              {m.kind === "weekly" ? <span className="text-sm text-muted">📋 {m.content}</span> : m.content}
            </div>
          ) : (
            <div key={m.id} className={`mr-6 rounded-2xl rounded-bl-md border px-4 py-3 ${m.kind === "weekly" ? "border-accent/40 bg-surface" : "border-line bg-surface"}`}>
              {m.content ? <Markdown text={m.content} /> : <span className="text-muted">Tänker…</span>}
            </div>
          ),
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div ref={bottom} />
      </section>

      <div className="chat-composer fixed inset-x-0 bottom-[calc(3.4rem+max(env(safe-area-inset-bottom),0.75rem))] z-10 border-t border-line bg-bg/95 pb-2 backdrop-blur">
        <div className="mx-auto max-w-md space-y-2 px-4 pt-2">
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {QUICK.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={!!busy || !configured} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-sm text-muted active:bg-surface-2 disabled:opacity-50">
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Skriv till coachen…"
              className="field"
              disabled={!configured}
              enterKeyHint="send"
            />
            <button className="btn-primary px-4" disabled={!!busy || !input.trim()}>Skicka</button>
          </form>
        </div>
      </div>
    </main>
  );
}
