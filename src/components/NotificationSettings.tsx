"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, BellSlash } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabaseBrowser } from "@/lib/supabase/client";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "ios-home" | "denied" | "off" | "on";

/** Pushnotiser: aktivera på den här telefonen, välj vilka och skicka en testnotis. */
export function NotificationSettings({ userId, weekly, medals }: { userId: string; weekly: boolean; medals: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [prefs, setPrefs] = useState({ notify_weekly: weekly, notify_medals: medals });

  useEffect(() => {
    (async () => {
      const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState(ios && !standalone ? "ios-home" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      setState((await reg.pushManager.getSubscription()) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    if (!KEY) return toast.error("Notiser är inte uppsatta i Vercel än.");
    setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
      const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error } = await supabaseBrowser()
        .from("push_subscriptions")
        .upsert({ user_id: userId, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
      if (error) throw error;
      setState("on");
      toast.success("Notiser är på");
    } catch (e) {
      console.error(e);
      toast.error("Kunde inte slå på notiser.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabaseBrowser().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setBusy(false);
    setState("off");
    toast.success("Notiser är avstängda på den här telefonen");
  }

  async function test() {
    setBusy(true);
    const res = await fetch("/api/push/test", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) toast.error(body.error ?? "Testnotisen gick inte iväg.");
    else toast.success("Testnotis skickad – den kommer om några sekunder");
  }

  async function toggle(k: keyof typeof prefs, v: boolean) {
    setPrefs((p) => ({ ...p, [k]: v }));
    const { error } = await supabaseBrowser().from("profile").update({ [k]: v }).eq("user_id", userId);
    if (error) {
      setPrefs((p) => ({ ...p, [k]: !v }));
      toast.error("Kunde inte spara.");
    }
  }

  if (state === "loading") return <p className="text-sm text-muted-foreground">Kollar notiser…</p>;
  if (state === "ios-home")
    return <p className="text-sm text-muted-foreground">På iPhone fungerar notiser bara i hemskärmsappen. Lägg appen på hemskärmen, öppna den därifrån och kom tillbaka hit.</p>;
  if (state === "unsupported") return <p className="text-sm text-muted-foreground">Den här webbläsaren stöder inte notiser.</p>;
  if (state === "denied")
    return (
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <BellSlash size={18} weight="duotone" className="mt-px shrink-0" />
        Notiser är blockerade. Tillåt dem i telefonens inställningar (iPhone: Inställningar → Notiser → Träning) och öppna appen igen.
      </p>
    );

  return (
    <div className="space-y-4">
      {state === "off" ? (
        <Button className="w-full" disabled={busy} onClick={enable}>
          <Bell size={18} weight="bold" /> Slå på notiser
        </Button>
      ) : (
        <p className="flex items-center gap-2 text-sm font-semibold text-brand">
          <Bell size={18} weight="fill" /> Notiser är på för den här telefonen
        </p>
      )}
      <div className="divide-y divide-border rounded-2xl bg-secondary/60">
        <label className="flex items-center justify-between gap-3 px-3 py-3">
          <span className="min-w-0">
            <span className="block text-[15px] font-medium">Veckoavstämning</span>
            <span className="block text-xs text-muted-foreground">Söndag kväll, om nästa veckas plan saknas</span>
          </span>
          <Switch checked={prefs.notify_weekly} onCheckedChange={(v) => toggle("notify_weekly", v)} />
        </label>
        <label className="flex items-center justify-between gap-3 px-3 py-3">
          <span className="min-w-0">
            <span className="block text-[15px] font-medium">Gruppmedaljer</span>
            <span className="block text-xs text-muted-foreground">När en challenge du är med i når målet</span>
          </span>
          <Switch checked={prefs.notify_medals} onCheckedChange={(v) => toggle("notify_medals", v)} />
        </label>
      </div>
      {state === "on" && (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={test}>Skicka testnotis</Button>
          <Button variant="ghost" className="flex-1" disabled={busy} onClick={disable}>Stäng av här</Button>
        </div>
      )}
    </div>
  );
}
