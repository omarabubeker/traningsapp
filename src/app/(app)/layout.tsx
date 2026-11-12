import { BottomNav } from "@/components/BottomNav";
import { AutoSync } from "@/components/AutoSync";
import { KeyboardWatcher } from "@/components/KeyboardWatcher";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Nya användare går först igenom introduktionen.
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from("profile").select("onboarded_at").maybeSingle();
  if (!p?.onboarded_at) redirect("/valkommen");

  return (
    <>
      <div className="pt-safe mx-auto max-w-md px-4 pb-28">{children}</div>
      <BottomNav />
      <AutoSync />
      <KeyboardWatcher />
    </>
  );
}
