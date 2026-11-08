import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { SPORT_LABEL, formatDuration, formatKm, formatPace, isRun } from "@/lib/running";
import type { Activity } from "@/lib/types";

export function ActivityRow({ a }: { a: Activity }) {
  const run = isRun(a.sport_type);
  return (
    <Link href={`/lopning/${a.id}`} className="card flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className={`mr-2 inline-block h-2 w-2 rounded-full align-middle ${run ? "bg-run" : "bg-muted"}`} />
        <span className="font-medium">{SPORT_LABEL[a.sport_type] ?? a.sport_type}</span>
        <span className="ml-2 inline-block text-sm text-muted first-letter:uppercase">
          {formatDate(a.start_time, { weekday: "short", day: "numeric", month: "short" })}
        </span>
      </span>
      <span className="shrink-0 text-right text-sm">
        {a.distance_m ? <span className="font-medium">{formatKm(a.distance_m)} km</span> : formatDuration(a.moving_time_s)}
        {run && a.avg_pace_s_per_km ? <span className="ml-2 text-muted">{formatPace(a.avg_pace_s_per_km)}/km</span> : null}
      </span>
    </Link>
  );
}
