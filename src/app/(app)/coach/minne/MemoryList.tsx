"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatDate } from "@/lib/dates";
import type { Memory } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";

const KIND: Record<Memory["kind"], string> = {
  advice: "Råd",
  plan_decision: "Beslut",
  feedback: "Återkoppling",
  injury_note: "Skada/känning",
  preference: "Preferens",
  goal: "Mål",
};

export function MemoryList({ initial }: { initial: Memory[] }) {
  const [items, setItems] = useState(initial);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Memory["kind"]>("preference");

  async function remove(id: string) {
    const { error } = await supabaseBrowser().from("coach_memory").update({ archived: true }).eq("id", id);
    if (!error) setItems((xs) => xs.filter((x) => x.id !== id));
  }
  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const { data, error } = await supabaseBrowser()
      .from("coach_memory")
      .insert({ kind, content: text.trim(), importance: kind === "injury_note" || kind === "goal" ? 3 : 2 })
      .select("id, kind, content, importance, valid_until, archived, created_at")
      .single();
    if (!error && data) {
      setItems((xs) => [data as Memory, ...xs]);
      setText("");
    }
  }

  return (
    <>
      <form onSubmit={add} className="card space-y-3">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="T.ex. Jag föredrar långpass på söndagar" />
        <div className="flex gap-2">
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as Memory["kind"])} className="flex-1">
            {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </NativeSelect>
          <Button className="px-4">Lägg till</Button>
        </div>
      </form>
      {items.length === 0 && <p className="card text-sm text-muted-foreground">Inget sparat än.</p>}
      <ul className="space-y-2">
        {items.map((m) => (
          <li key={m.id} className="card flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {KIND[m.kind]} · {formatDate(m.created_at, { day: "numeric", month: "short" })}
                {m.valid_until && ` · gäller till ${formatDate(m.valid_until + "T12:00:00Z", { day: "numeric", month: "short" })}`}
              </p>
              <p className="mt-1">{m.content}</p>
            </div>
            <button onClick={() => remove(m.id)} className="shrink-0 px-2 py-1 text-muted-foreground" aria-label="Ta bort">×</button>
          </li>
        ))}
      </ul>
    </>
  );
}
