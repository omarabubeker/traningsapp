import Link from "next/link";
import { Barbell, Bicycle, Lightning, Mountains, PersonSimpleRun, PersonSimpleWalk, SwimmingPool } from "@phosphor-icons/react/dist/ssr";
import { formatDate } from "@/lib/dates";
import { SPORT_LABEL, formatDuration, formatKm, formatPace, isRun } from "@/lib/running";
import type { Activity } from "@/lib/types";
import { IconBadge, type Icon, type Tone } from "./CardParts";

function sportIcon(sport: string): { icon: Icon; tone: Tone } {
  if (isRun(sport)) return { icon: PersonSimpleRun, tone: "run" };
  if (sport === "Walk") return { icon: PersonSimpleWalk, tone: "brand" };
  if (sport === "Hike") return { icon: Mountains, tone: "brand" };
  if (/ride/i.test(sport)) return { icon: Bicycle, tone: "brand" };
  if (sport === "Swim") return { icon: SwimmingPool, tone: "run" };
  if (/strength|weight/i.test(sport)) return { icon: Barbell, tone: "gym" };
  return { icon: Lightning, tone: "streak" };
}

export function ActivityRow({ a }: { a: Activity }) {
  const run = isRun(a.sport_type);
  const { icon, tone } = sportIcon(a.sport_type);
  return (
    <Link href={`/lopning/${a.id}`} className="card flex items-center gap-3 py-4 active:bg-secondary">
      <IconBadge icon={icon} tone={tone} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{SPORT_LABEL[a.sport_type] ?? a.sport_type}</span>
        <span className="block text-sm text-muted-foreground first-letter:uppercase">
          {formatDate(a.start_time, { weekday: "short", day: "numeric", month: "short" })}
        </span>
      </span>
      <span className="shrink-0 text-right tabular-nums">
        <span className="block font-semibold">{a.distance_m ? `${formatKm(a.distance_m)} km` : formatDuration(a.moving_time_s)}</span>
        {run && a.avg_pace_s_per_km ? <span className="block text-sm text-muted-foreground">{formatPace(a.avg_pace_s_per_km)}/km</span> : null}
      </span>
    </Link>
  );
}
