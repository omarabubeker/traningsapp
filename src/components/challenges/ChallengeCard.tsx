"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Barbell, CalendarCheck, PersonSimpleRun, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { CardHead, type Icon } from "@/components/CardParts";
import { Button } from "@/components/ui/button";
import { Medal } from "@/components/goals/Medal";
import { confirmDialog } from "@/components/ConfirmDialog";
import { supabaseBrowser } from "@/lib/supabase/client";
import { daysLeft, formatAmount, journeyPosition, liftComparison, type Metric } from "@/lib/challenges";
import type { ChallengeView } from "@/lib/challengesData";
import { formatDate } from "@/lib/dates";

const ICON: Record<Metric, Icon> = { km: PersonSimpleRun, sessions: CalendarCheck, kg: Barbell };
const TONE = { km: "run", sessions: "brand", kg: "gym" } as const;
const BAR = { km: "bg-run", sessions: "bg-primary", kg: "bg-gym" } as const;

/** Gruppchallenge: gruppens totalsumma, antal deltagare och ens eget bidrag (inga andras siffror). */
export function ChallengeCard({ c, today }: { c: ChallengeView; today: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const total = formatAmount(c.metric, c.total);
  const target = formatAmount(c.metric, c.target);
  const mine = formatAmount(c.metric, c.mine);
  const pct = Math.min(100, (c.total / c.target) * 100);
  const journey = journeyPosition(c.theme, c.total);
  const lifted = c.metric === "kg" ? liftComparison(c.total) : null;
  const left = daysLeft(c, today);

  async function join(on: boolean) {
    if (!on && !(await confirmDialog({ title: "Gå ur challengen?", description: "Dina pass slutar räknas in i gruppens summa.", confirmLabel: "Gå ur", danger: true }))) return;
    setBusy(true);
    const sb = supabaseBrowser();
    const { error } = on ? await sb.from("challenge_members").insert({ challenge_id: c.id }) : await sb.from("challenge_members").delete().eq("challenge_id", c.id);
    setBusy(false);
    if (error) return toast.error("Det gick inte just nu. Försök igen.");
    if (on) toast.success("Du är med! Dina pass räknas automatiskt.");
    router.refresh();
  }

  const right =
    c.state === "upcoming"
      ? `Startar ${formatDate(c.start_date + "T12:00:00Z", { day: "numeric", month: "short" })}`
      : c.state === "ended"
        ? "Avslutad"
        : left === 0
          ? "Sista dagen"
          : `${left} ${left === 1 ? "dag" : "dagar"} kvar`;

  return (
    <article className={`card space-y-4 ${c.done ? "border-brand/50" : ""}`}>
      <CardHead icon={ICON[c.metric]} tone={TONE[c.metric]} title={c.title} right={right} />

      <div className="flex items-end justify-between gap-3">
        <p className="num-xl">
          {total.value}
          <span className="unit">{total.unit === target.unit ? `av ${target.value} ${target.unit}` : `${total.unit} av ${target.value} ${target.unit}`}</span>
        </p>
        {c.done && <Medal id={`ch-${c.id}`} size={48} text={target.value.length <= 3 ? target.value : undefined} />}
      </div>

      {journey ? (
        <div className="space-y-2">
          <div className="relative h-2.5 rounded-full bg-secondary">
            <div className={`h-full rounded-full ${BAR[c.metric]}`} style={{ width: `${pct}%` }} />
            {journey.stops.slice(0, -1).map((s) => (
              <span
                key={s.name}
                className={`absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card ${c.total >= s.km ? "bg-card" : "bg-muted-foreground/40"}`}
                style={{ left: `${(s.km / c.target) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{journey.from}</span>
            <span>{journey.stops.at(-1)?.name}</span>
          </div>
          <p className="text-sm">
            {journey.next ? (
              <>
                {journey.passed !== journey.from && <>Förbi <b>{journey.passed}</b> · </>}
                {Math.ceil(journey.kmToNext)} km kvar till <b>{journey.next.name}</b>
              </>
            ) : (
              <>Framme i <b>{journey.passed}</b>!</>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="h-2.5 rounded-full bg-secondary">
            <div className={`h-full rounded-full ${BAR[c.metric]}`} style={{ width: `${pct}%` }} />
          </div>
          {c.metric === "kg" && <p className="text-sm">{lifted ? <>Ni har lyft lika mycket som <b>{lifted}</b></> : "Varje set räknas – första stoppet är en flygel (500 kg)."}</p>}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <UsersThree size={18} weight="duotone" />
          {c.participants === 0 ? "Ingen med än" : `${c.participants} med`}
        </span>
        {c.joined && <span>Ditt bidrag: <b className="text-foreground">{mine.value} {mine.unit}</b></span>}
      </div>

      {c.done && <p className="font-semibold text-brand">Klart – ni klarade det tillsammans!</p>}

      {c.state !== "ended" &&
        (c.joined ? (
          <button type="button" disabled={busy} onClick={() => join(false)} className="text-sm text-muted-foreground underline-offset-4 active:underline">
            Gå ur challengen
          </button>
        ) : (
          <Button className="w-full" disabled={busy} onClick={() => join(true)}>
            Jag är med
          </Button>
        ))}
    </article>
  );
}
