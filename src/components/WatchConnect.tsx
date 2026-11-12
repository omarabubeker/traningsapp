"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowSquareOut, CheckCircle, Watch, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmDialog } from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/dates";
import { SPORT_LABEL } from "@/lib/running";
import { runSync } from "@/components/AutoSync";

export type WatchStatus = {
  source: "own" | "env" | null; // egen nyckel, ägarens serverinställning, eller ingen
  athleteId?: string | null;
  name?: string | null;
  brand?: string | null;
};

const BRANDS = [
  { key: "apple", label: "Apple Watch" },
  { key: "garmin", label: "Garmin" },
  { key: "polar", label: "Polar" },
  { key: "coros", label: "Coros" },
  { key: "suunto", label: "Suunto" },
  { key: "wahoo", label: "Wahoo" },
  { key: "other", label: "Annan" },
] as const;
type Brand = (typeof BRANDS)[number]["key"];

const LINKS = {
  intervals: "https://intervals.icu",
  settings: "https://intervals.icu/settings",
  companion: "https://apps.apple.com/app/id6739638454",
};

type Latest = { sport?: string; start?: string; km?: number | null; count: number } | null;

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="mt-2">
      <Button asChild variant="secondary" size="sm">
        <a href={href} target="_blank" rel="noreferrer">
          {children} <ArrowSquareOut size={14} weight="bold" />
        </a>
      </Button>
    </div>
  );
}

function Steps({ brand }: { brand: Brand }) {
  const name = BRANDS.find((b) => b.key === brand)!.label;
  const steps: React.ReactNode[] = [
    <>
      Skapa ett gratis konto på intervals.icu.
      <LinkButton href={LINKS.intervals}>Öppna intervals.icu</LinkButton>
    </>,
  ];
  if (brand === "apple") {
    steps.push(
      <>
        Installera appen <b>Intervals.icu Companion</b> på iPhonen.
        <LinkButton href={LINKS.companion}>Öppna i App Store</LinkButton>
      </>,
      <>Öppna Companion, logga in med ditt intervals.icu-konto och tillåt åtkomst till Hälsa. Slå på automatisk synk av träningspass – välj gärna att synka bakåt så kommer äldre pass med.</>,
      <>
        För att få planens löppass på klockan: i Companion, <b>Settings → Workout Settings</b>, slå på automatisk synk till Apple Watch. Öppna Companion ibland – passen för de kommande 7 dagarna skickas när appen öppnas. På klockan: <b>Träning → Löpning utomhus → ⋯</b>.
      </>,
    );
  } else if (brand === "other") {
    steps.push(
      <>
        På intervals.icu: <b>Settings → Connections</b>. Se om din klocka finns där och koppla den. (Pass som bara finns på Strava går tyvärr inte att hämta vidare.)
        <LinkButton href={LINKS.settings}>Öppna Settings</LinkButton>
      </>,
    );
  } else {
    steps.push(
      <>
        På intervals.icu: <b>Settings → Connections</b> och koppla ditt {name}-konto. Nya pass synkas sedan automatiskt efter varje träning – och planens löppass skickas till klockan om du slår på uppladdning av planerade pass där.
        <LinkButton href={LINKS.settings}>Öppna Settings</LinkButton>
      </>,
    );
  }
  steps.push(
    <>
      Hämta nyckeln: på intervals.icu, <b>Settings → Developer Settings</b> (längst ner). Där står ditt <b>Athlete ID</b> (t.ex. i123456). Under <b>API Key</b>, tryck <i>View</i> och kopiera nyckeln.
    </>,
  );
  return (
    <ol className="space-y-3">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand">{i + 1}</span>
          <div className="min-w-0 flex-1 pt-0.5">{s}</div>
        </li>
      ))}
    </ol>
  );
}

function LatestLine({ latest }: { latest: Latest }) {
  if (!latest) return null;
  if (!latest.count)
    return (
      <p className="flex items-start gap-2 text-sm text-gym">
        <WarningCircle size={18} weight="fill" className="mt-px shrink-0" />
        Kopplingen fungerar, men inga pass hittades de senaste 30 dagarna. Kontrollera att klockan synkar till intervals.icu.
      </p>
    );
  return (
    <p className="flex items-start gap-2 text-sm text-brand">
      <CheckCircle size={18} weight="fill" className="mt-px shrink-0" />
      <span>
        Hittade {latest.count} pass. Senaste: {SPORT_LABEL[latest.sport ?? ""] ?? latest.sport}{" "}
        {latest.start ? formatDate(latest.start, { weekday: "short", day: "numeric", month: "short" }) : ""}
        {latest.km ? `, ${latest.km.toLocaleString("sv-SE")} km` : ""}.
      </span>
    </p>
  );
}

/** Koppla klockan: guide per märke, fält för athlete-id och nyckel, test av hela kedjan. */
export function WatchConnect({ status, onDone }: { status: WatchStatus; onDone?: () => void }) {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand>((status.brand as Brand) ?? "apple");
  const [showForm, setShowForm] = useState(status.source !== "own");
  const [athleteId, setAthleteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState<null | "connect" | "test" | "remove">(null);
  const [latest, setLatest] = useState<Latest>(null);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    setBusy("connect");
    setError(null);
    const res = await fetch("/api/klocka", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ athleteId, apiKey, brand }) });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error ?? "Kunde inte koppla.");
    setApiKey("");
    setLatest(body.latest ?? null);
    setShowForm(false);
    toast.success(body.name ? `Kopplad till ${body.name}` : "Klockan är kopplad");
    router.refresh();
    // Hämta passen direkt
    runSync().then((r) => r.changed && router.refresh());
    onDone?.();
  }

  async function test() {
    setBusy("test");
    setError(null);
    const res = await fetch("/api/klocka");
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body.error ?? "Testet misslyckades.");
    setLatest(body.latest ?? null);
  }

  async function remove() {
    if (!(await confirmDialog({ title: "Koppla från klockan?", description: "Nyckeln tas bort från appen. Dina pass finns kvar.", confirmLabel: "Koppla från", danger: true }))) return;
    setBusy("remove");
    const res = await fetch("/api/klocka", { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return toast.error("Kunde inte koppla från.");
    toast.success("Klockan är frånkopplad");
    setShowForm(true);
    setLatest(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {status.source && (
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
            <Watch size={22} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{status.source === "own" ? `Kopplad${status.name ? ` till ${status.name}` : ""}` : "Kopplad via serverinställning"}</p>
            <p className="text-sm text-muted-foreground">
              {status.source === "own"
                ? `${BRANDS.find((b) => b.key === status.brand)?.label ?? "Klocka"} · intervals.icu ${status.athleteId ?? ""}`
                : "Din nyckel ligger i Vercel. Lägg in den här nedan så blir det din egen koppling."}
            </p>
          </div>
        </div>
      )}

      {status.source && (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={test} disabled={!!busy}>{busy === "test" ? "Testar…" : "Testa kopplingen"}</Button>
          {status.source === "own" && !showForm && (
            <Button variant="secondary" size="sm" onClick={() => setShowForm(true)}>Byt nyckel</Button>
          )}
          {status.source === "own" && (
            <Button variant="ghost" size="sm" className="text-danger" onClick={remove} disabled={!!busy}>Koppla från</Button>
          )}
        </div>
      )}

      <LatestLine latest={latest} />
      {error && <p className="flex items-start gap-2 text-sm text-danger"><WarningCircle size={18} weight="fill" className="mt-px shrink-0" />{error}</p>}

      {showForm && (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="label">Vilken klocka har du?</p>
            <div className="flex flex-wrap gap-2">
              {BRANDS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBrand(b.key)}
                  className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${brand === b.key ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
          <Steps brand={brand} />
          <div className="grid gap-3">
            <div>
              <label className="label" htmlFor="athlete-id">Athlete ID</label>
              <Input id="athlete-id" placeholder="i123456" autoCapitalize="off" autoCorrect="off" value={athleteId} onChange={(e) => setAthleteId(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="api-key">API-nyckel</label>
              <Input id="api-key" type="password" autoComplete="off" placeholder="Klistra in nyckeln" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
              <p className="mt-1 text-xs text-muted-foreground">Nyckeln sparas krypterad och används bara för att hämta dina pass.</p>
            </div>
          </div>
          <Button className="w-full" onClick={connect} disabled={!!busy || !athleteId.trim() || !apiKey.trim()}>
            {busy === "connect" ? "Kopplar och testar…" : "Koppla och testa"}
          </Button>
        </div>
      )}
    </div>
  );
}
