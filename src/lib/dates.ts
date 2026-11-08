export const TZ = "Europe/Stockholm";

/** YYYY-MM-DD i svensk tid. */
export function isoDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Måndag i innevarande vecka (svensk tid) som Date i UTC-midnatt för den dagen + dagsnyckel. */
export function weekRange(now: Date = new Date()) {
  const today = isoDay(now);
  const base = new Date(today + "T00:00:00Z");
  const dow = (base.getUTCDay() + 6) % 7; // 0 = måndag
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() - dow + i);
    return d.toISOString().slice(0, 10);
  });
  // Marginal ±1 dag för tidszon; filtrering sker per svensk dag.
  const from = new Date(days[0] + "T00:00:00Z");
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(days[6] + "T00:00:00Z");
  to.setUTCDate(to.getUTCDate() + 2);
  return { days, today, from: from.toISOString(), to: to.toISOString() };
}

export function weekNumber(dayIso: string): number {
  const d = new Date(dayIso + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

export const WEEKDAYS_SHORT = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];

export function formatDate(d: string | Date, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, ...opts }).format(typeof d === "string" ? new Date(d) : d);
}

export function formatTime(d: string | Date) {
  return formatDate(d, { hour: "2-digit", minute: "2-digit" });
}

export function ageFrom(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate + "T00:00:00Z");
  const now = new Date(isoDay() + "T00:00:00Z");
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export function formatKg(n: number) {
  return Number(n).toLocaleString("sv-SE", { maximumFractionDigits: 2 });
}
