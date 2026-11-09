"use client";
import { useRouter } from "next/navigation";
import { MoreMenu } from "@/components/MoreMenu";
import { confirmDialog } from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { supabaseBrowser } from "@/lib/supabase/client";

/** Raderar (döljer) ett pass. Synken från klockan återställer det inte. */
export function ActivityMenu({ id }: { id: string }) {
  const router = useRouter();
  async function remove() {
    if (!(await confirmDialog({ title: "Radera passet?", description: "Det tas bort från appen, översikten och coachens underlag.", confirmLabel: "Radera", danger: true }))) return;
    const { error } = await supabaseBrowser().from("activities").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return void toast.error("Kunde inte radera passet.");
    toast.success("Passet är raderat");
    router.push("/lopning");
    router.refresh();
  }
  return <MoreMenu items={[{ label: "Radera pass", onSelect: remove, danger: true }]} />;
}
