"use client";
import { useRouter } from "next/navigation";
import { MoreMenu } from "@/components/MoreMenu";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Raderar (döljer) ett pass. Synken från klockan återställer det inte. */
export function ActivityMenu({ id }: { id: string }) {
  const router = useRouter();
  async function remove() {
    if (!confirm("Radera passet? Det tas bort från appen, översikten och coachens underlag.")) return;
    const { error } = await supabaseBrowser().from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return alert("Kunde inte radera passet.");
    router.push("/lopning");
    router.refresh();
  }
  return <MoreMenu items={[{ label: "Radera pass", onSelect: remove, danger: true }]} />;
}
