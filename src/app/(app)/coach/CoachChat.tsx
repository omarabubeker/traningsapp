"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { formatDate } from "@/lib/dates";
import type { Conversation } from "@/lib/coach/conversation";

export type ChatMessage = { id: string; role: "user" | "assistant"; kind: "chat" | "weekly"; content: string; created_at: string };

const QUICK = ["Trött i dag", "Kändes bra", "Har ont någonstans", "Vad ska jag köra idag?", "Hinner inte dagens pass"];

type Props = { current: ChatMessage[]; previous: Conversation[]; configured: boolean };

export function CoachChat({ current, previous: prevInitial, configured }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState(current);
  const [previous, setPrevious] = useState(prevInitial);
  const [forceNew, setForceNew] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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
      const res = await fetch("/api/coach/chat", { method: "POST", body: JSON.stringify({ message: content, newConversation: forceNew }) });
      setForceNew(false);
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

  function newConversation() {
    if (!messages.length) return;
    const now = new Date().toISOString();
    setPrevious((p) => [...p, { id: "lokalt-" + now, startedAt: messages[0].created_at, messages: messages as Conversation["messages"] }]);
    setMessages([]);
    setForceNew(true);
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

      {previous.length > 0 && (
        <section className="mb-4">
          <button onClick={() => setShowHistory((v) => !v)} className="w-full py-2 text-left text-sm text-muted">
            {showHistory ? "▾" : "▸"} Tidigare samtal ({previous.length})
          </button>
          {showHistory && (
            <div className="space-y-2">
              {[...previous].reverse().map((c) => <OldConversation key={c.id} conv={c} />)}
            </div>
          )}
        </section>
      )}

      {messages.length > 0 && (
        <div className="mb-3 flex justify-end">
          <button onClick={newConversation} disabled={!!busy} className="text-sm text-accent">+ Nytt samtal</button>
        </div>
      )}

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

function OldConversation({ conv }: { conv: Conversation }) {
  const [open, setOpen] = useState(false);
  const first = conv.messages.find((m) => m.role === "user");
  const title = first?.kind === "weekly" ? "Veckoavstämning" : first?.content ?? "Samtal";
  return (
    <div className="card p-3">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-baseline justify-between gap-3 text-left">
        <span className="truncate text-sm">{title}</span>
        <span className="shrink-0 text-xs text-muted">
          {formatDate(conv.startedAt, { day: "numeric", month: "short" })} · {conv.messages.length} medd.
        </span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-sm">
          {conv.messages.map((m) =>
            m.role === "user" ? (
              <p key={m.id} className="ml-8 rounded-xl bg-accent/10 px-3 py-2 text-right">{m.content}</p>
            ) : (
              <div key={m.id} className="mr-4 rounded-xl border border-line px-3 py-2"><Markdown text={m.content} /></div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
