import { formatDate } from "@/lib/dates";
import { STATUS_LABEL, type ItemStatus } from "@/lib/coach/plan";
import type { PlanItem } from "@/lib/types";

type Target = {
  distance_km?: number | null;
  duration_min?: number | null;
  intensity?: string | null;
  exercises?: { name: string; sets: number; reps: string; weight_kg: number | null }[];
};

const KIND_STYLE: Record<PlanItem["kind"], string> = {
  run: "bg-run",
  gym: "bg-gym",
  rest: "bg-line",
  other: "bg-muted",
};
const STATUS_STYLE: Record<ItemStatus, string> = {
  done: "text-accent",
  missed: "text-danger",
  today: "text-text",
  upcoming: "text-muted",
  rest: "text-muted",
};

export function PlanItemCard({ item, status, showDate = true }: { item: PlanItem; status: ItemStatus; showDate?: boolean }) {
  const t = (item.target ?? {}) as Target;
  if (item.kind === "rest") {
    return (
      <div className="flex items-baseline justify-between gap-2 rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm text-muted">
        <span>
          {showDate && <span className="mr-2 inline-block first-letter:uppercase">{formatDate(item.date + "T12:00:00Z", { weekday: "short", day: "numeric" })}</span>}
          {item.title}
        </span>
        {item.description && <span className="truncate text-xs">{item.description}</span>}
      </div>
    );
  }
  const facts = [
    t.distance_km ? `${t.distance_km.toLocaleString("sv-SE")} km` : null,
    t.duration_min ? `${t.duration_min} min` : null,
    t.intensity,
  ].filter(Boolean);
  return (
    <div className={`card ${status === "today" ? "border-accent/60" : ""} ${status === "done" ? "opacity-70" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">
          <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${KIND_STYLE[item.kind]}`} />
          {item.title}
        </p>
        <span className={`shrink-0 text-xs ${STATUS_STYLE[status]}`}>
          {status === "done" ? "✓ " : status === "missed" ? "✗ " : ""}
          {STATUS_LABEL[status]}
        </span>
      </div>
      {showDate && (
        <p className="mt-0.5 inline-block text-xs text-muted first-letter:uppercase">
          {formatDate(item.date + "T12:00:00Z", { weekday: "long", day: "numeric", month: "short" })}
        </p>
      )}
      {facts.length > 0 && <p className="mt-2 text-sm">{facts.join(" · ")}</p>}
      {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
      {t.exercises && t.exercises.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {t.exercises.map((e, i) => (
            <li key={i} className="flex justify-between gap-2">
              <span>{e.name}</span>
              <span className="text-muted tabular-nums">
                {e.sets} × {e.reps}
                {e.weight_kg ? ` · ${e.weight_kg.toLocaleString("sv-SE")} kg` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
