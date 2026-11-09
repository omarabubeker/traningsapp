import { BottomNav } from "@/components/BottomNav";
import { AutoSync } from "@/components/AutoSync";
import { KeyboardWatcher } from "@/components/KeyboardWatcher";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pt-safe mx-auto max-w-md px-4 pb-28">{children}</div>
      <BottomNav />
      <AutoSync />
      <KeyboardWatcher />
    </>
  );
}
