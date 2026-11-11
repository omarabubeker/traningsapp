import Link from "next/link";
import { requireUser } from "@/lib/supabase/server";
import type { Memory } from "@/lib/types";
import { MemoryList } from "./MemoryList";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";

export const dynamic = "force-dynamic";

export default async function MinnePage() {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("coach_memory")
    .select("id, kind, content, importance, valid_until, archived, created_at")
    .eq("archived", false)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <main className="space-y-4 pt-3">
      <header className="flex items-center gap-3">
        <Link href="/coach" className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground active:bg-secondary" aria-label="Tillbaka"><CaretLeft size={22} weight="bold" /></Link>
        <h1 className="h-detail">Coachens minne</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        Det här kommer coachen ihåg från era samtal. Ta bort det som inte stämmer, eller lägg till något den ska veta.
      </p>
      <MemoryList initial={(data ?? []) as Memory[]} />
    </main>
  );
}
