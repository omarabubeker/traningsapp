import { Barbell, Check, ChatCircleText, Gauge, Lightning, Moon, PersonSimpleRun } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/dates";
import type { ItemStatus } from "@/lib/coach/plan";
import type { PlanItem } from "@/lib/types";
import { IconBadge, type Icon, type Tone } from "./CardParts";

type Target = {
  distance_km?: number | null;
  duration_min?: number | null;
  intensity?: string | null;
  exercises?: { name: string; sets: number; reps: string; weight_kg: number | null }[];
};

const KIND: Record<Exclude<PlanItem["kind"], "rest">, { icon: Icon; tone: Tone }> = {
  run: { icon: PersonSimpleRun, tone: "run" },
  gym: { icon: Barbell, tone: "gym" },
  other: { icon: Lightning, tone: "streak" },
};

/** Statusetikett: Klart (med dag om passet flyttats), Idag, Kvar i veckan eller Missat. */
function StatusPill({ status, moved }: { status: ItemStatus; moved?: string }) {
  if (status === "upcoming" || status === "rest") return null;
  const style = {
    done: "bg-brand/15 text-brand",
    today: "bg-primary text-primary-foreground",
    pending: "bg-gym/15 text-gym",
    missed: "bg-danger/15 text-danger",
  }[status];
  const label = { done: "Klart", today: "Idag", pending: "Kvar i veckan", missed: "Missat" }[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${style}`}>
      {status === "done" && <Check size={12} weight="bold" />}
      {label}
      {moved && ` ${moved}`}
    </span>
  );
}

const sv = (n: number) => n.toLocaleString("sv-SE");

export function PlanItemCard({ item, status, doneDay, showDate = true }: { item: PlanItem; status: ItemStatus; doneDay?: string; showDate?: boolean }) {
  const t = (item.target ?? {}) as Target;
  if (item.kind === "rest") {
    return (
      <div className="flex items-center gap-3 rounded-[22px] border border-dashed border-border px-4 py-3.5 text-muted-foreground">
        <Moon size={22} weight="duotone" className="shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">{item.title}</span>
          {item.description && <span className="block truncate text-sm">{item.description}</span>}
        </span>
      </div>
    );
  }
  const { icon, tone } = KIND[item.kind];
  const moved = status === "done" && doneDay && doneDay !== item.date ? formatDate(doneDay + "T12:00:00Z", { weekday: "short" }) : undefined;
  const stats = [
    t.distance_km ? { v: sv(t.distance_km), u: "km" } : null,
    t.duration_min ? { v: String(t.duration_min), u: "min" } : null,
    t.exercises?.length ? { v: String(t.exercises.length), u: t.exercises.length === 1 ? "övning" : "övningar" } : null,
  ].filter((x): x is { v: string; u: string } => !!x);

  return (
    <article className={`card space-y-4 ${status === "today" ? "border-brand/60" : status === "done" ? "border-brand/25" : ""}`}>
      <header className="flex items-start gap-3">
        <IconBadge icon={icon} tone={tone} />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] leading-snug font-bold">{item.title}</h3>
          {showDate && (
            <p className="text-sm text-muted-foreground first-letter:uppercase">{formatDate(item.date + "T12:00:00Z", { weekday: "long", day: "numeric", month: "short" })}</p>
          )}
        </div>
        <StatusPill status={status} moved={moved} />
      </header>

      {stats.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {stats.map((s) => (
            <p key={s.u} className="num-lg">
              {s.v}
              <span className="ml-1 text-xs font-bold uppercase text-muted-foreground">{s.u}</span>
            </p>
          ))}
        </div>
      )}

      {t.intensity && (
        <p className="flex items-start gap-2 text-sm">
          <Gauge size={18} weight="duotone" className="mt-px shrink-0 text-muted-foreground" />
          <span>{t.intensity}</span>
        </p>
      )}

      {t.exercises && t.exercises.length > 0 && (
        <ol className="divide-y divide-border rounded-2xl bg-secondary/60">
          {t.exercises.map((e, i) => (
            <li key={i} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gym/15 text-xs font-bold text-gym">{i + 1}</span>
              <span className="min-w-0 flex-1 text-[15px] font-medium">{e.name}</span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block text-sm font-bold">{e.sets} × {e.reps}</span>
                {e.weight_kg ? <span className="block text-xs text-muted-foreground">{sv(e.weight_kg)} kg</span> : null}
              </span>
            </li>
          ))}
        </ol>
      )}

      {item.description && (
        <div className="flex gap-2.5 rounded-2xl bg-secondary/60 p-3 text-sm">
          <ChatCircleText size={18} weight="duotone" className="mt-px shrink-0 text-brand" />
          <p className="text-muted-foreground">{item.description}</p>
        </div>
      )}
    </article>
  );
}
