// Mål: typer och beräkningar som bara beror på målet (rena funktioner, testas i goals.test.ts).

export type Goal = {
  id: string;
  kind: "race" | "general";
  /** Vad målet handlar om: lopp, styrka (övning + målvikt) eller annat. */
  focus?: "run" | "strength" | "general";
  exercise?: string | null;
  target_kg?: number | null;
  title: string;
  distance_km: number | null;
  race_date: string | null;
  target_time_s: number | null;
  start_date: string;
  notes: string | null;
  is_primary: boolean;
  status: "active" | "completed" | "archived";
  result_time_s: number | null;
  completed_at: string | null;
  created_at?: string;
};

export const DISTANCES = [
  { km: 5, label: "5 km" },
  { km: 10, label: "10 km" },
  { km: 21.0975, label: "Halvmaraton" },
  { km: 42.195, label: "Maraton" },
] as const;

export const isMarathon = (km: number) => km >= 40;

/** Dagar kvar till loppet (negativt = passerat). null för mål utan datum. */
export function daysTo(goal: Pick<Goal, "race_date">, today: string) {
  if (!goal.race_date) return null;
  return Math.round((Date.parse(goal.race_date + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5);
}

/** Måltempo i sek/km, eller null. */
export function goalPace(goal: Pick<Goal, "distance_km" | "target_time_s">) {
  return goal.distance_km && goal.target_time_s ? goal.target_time_s / goal.distance_km : null;
}

/** Riegels formel: motsvarande tid på en annan distans (t2 = t1 · (d2/d1)^1,06). */
export function riegel(timeS: number, fromKm: number, toKm: number) {
  return timeS * Math.pow(toKm / fromKm, 1.06);
}

/** 3:59:59, 52:30 eller 24:05. */
export function formatTime(sec: number) {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

/** Tolkar "3:59:59", "3:59", "52:30" (min:sek om första talet ≥ 10 och två delar) eller "4" (timmar). */
export function parseTime(text: string): number | null {
  const parts = text.trim().replace(/[.,]/g, ":").split(":").filter(Boolean).map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] >= 10 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60;
  return parts[0] * 3600;
}

export function distanceLabel(km: number) {
  const d = DISTANCES.find((x) => Math.abs(x.km - km) < 0.05);
  return d ? d.label : `${km.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km`;
}

/** Kort beskrivning, t.ex. "Maraton 29 maj · under 3:59:59". */
export function goalSummary(goal: Goal) {
  const by = goal.race_date ? `till ${new Date(goal.race_date + "T12:00:00Z").toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" })}` : null;
  if (goal.focus === "strength") return ["Uppskattat 1RM ur dina set", by].filter(Boolean).join(" · ");
  if (goal.kind === "general") return [goal.notes, by].filter(Boolean).join(" · ") || goal.title;
  const date = goal.race_date ? new Date(goal.race_date + "T12:00:00Z").toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" }) : "";
  return [distanceLabel(goal.distance_km!), date, goal.target_time_s ? `mål ${formatTime(goal.target_time_s)}` : null].filter(Boolean).join(" · ");
}

/** Text på loppmedaljen: 42K, 21K, 10K … */
export function raceBadge(km: number) {
  return `${Math.round(km)}K`;
}
