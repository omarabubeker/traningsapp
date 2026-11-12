"use client";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Trash } from "@phosphor-icons/react/dist/ssr";
import { createChallenge, deleteChallenge, type ActionResult } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { confirmDialog } from "@/components/ConfirmDialog";
import { METRIC_LABEL, PRESETS, formatAmount, type Challenge, type Metric } from "@/lib/challenges";
import { formatDate } from "@/lib/dates";

const chip = (on: boolean) =>
  `rounded-full border px-3.5 py-2 text-sm font-semibold transition ${on ? "border-transparent bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`;
const UNIT: Record<Metric, string> = { km: "km", sessions: "pass", kg: "kg" };
const short = (d: string) => formatDate(d + "T12:00:00Z", { day: "numeric", month: "short" });

/** Ägarens del för gruppchallenger: skapa från förslag eller eget, och ta bort. */
export function ChallengeAdmin({ challenges, today, defaultEnd }: { challenges: Challenge[]; today: string; defaultEnd: string }) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(createChallenge, { ok: false });
  const [metric, setMetric] = useState<Metric>("km");
  const [title, setTitle] = useState(PRESETS.km[0].title);
  const [target, setTarget] = useState(String(PRESETS.km[0].target));
  const [theme, setTheme] = useState<string | null>(PRESETS.km[0].theme);

  useEffect(() => {
    if (state.ok) toast.success("Challengen är skapad – den syns på allas översikt");
  }, [state]);

  function pickMetric(m: Metric) {
    setMetric(m);
    const p = PRESETS[m][0];
    setTitle(p.title);
    setTarget(String(p.target));
    setTheme(p.theme);
  }

  return (
    <div className="space-y-3">
      <form action={action} className="card space-y-4">
        <p className="h-card">Ny challenge</p>
        <input type="hidden" name="metric" value={metric} />
        <input type="hidden" name="theme" value={theme ?? ""} />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as Metric[]).map((m) => (
            <button key={m} type="button" className={chip(metric === m)} onClick={() => pickMetric(m)}>
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <p className="label">Förslag</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS[metric].map((p) => (
              <button
                key={p.title}
                type="button"
                className={chip(title === p.title && target === String(p.target))}
                onClick={() => {
                  setTitle(p.title);
                  setTarget(String(p.target));
                  setTheme(p.theme);
                }}
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ch-title">Namn</label>
          <Input id="ch-title" name="title" maxLength={60} value={title} onChange={(e) => (setTitle(e.target.value), setTheme(null))} />
        </div>
        <div>
          <label className="label" htmlFor="ch-target">Mål ({UNIT[metric]} tillsammans)</label>
          <Input id="ch-target" name="target" inputMode="decimal" value={target} onChange={(e) => (setTarget(e.target.value), setTheme(null))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ch-start">Start</label>
            <Input id="ch-start" name="start" type="date" defaultValue={today} />
          </div>
          <div>
            <label className="label" htmlFor="ch-end">Slut</label>
            <Input id="ch-end" name="end" type="date" defaultValue={defaultEnd} />
          </div>
        </div>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button className="w-full" disabled={pending}>{pending ? "Skapar…" : "Skapa challenge"}</Button>
        <p className="text-xs text-muted-foreground">Alla ser den på översikten och går med själva. Bara gruppens summa visas.</p>
      </form>

      {challenges.map((c) => {
        const t = formatAmount(c.metric, Number(c.target));
        return (
          <div key={c.id} className="card flex items-center gap-3 py-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{c.title}</span>
              <span className="block text-sm text-muted-foreground">
                {t.value} {t.unit} · {short(c.start_date)}–{short(c.end_date)}
                {c.end_date < today ? " · avslutad" : ""}
              </span>
            </span>
            <button
              type="button"
              aria-label={`Ta bort ${c.title}`}
              className="flex size-10 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
              onClick={async () => {
                if (await confirmDialog({ title: `Ta bort ${c.title}?`, description: "Challengen försvinner för alla. Passen finns kvar.", confirmLabel: "Ta bort", danger: true }))
                  await deleteChallenge(c.id);
              }}
            >
              <Trash size={20} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
