export type Metric = "km" | "sessions" | "kg";

export type Challenge = {
  id: string;
  title: string;
  metric: Metric;
  target: number;
  theme: string | null;
  start_date: string;
  end_date: string;
};

export type ChallengeProgress = { total: number; participants: number; mine: number; joined: boolean };

export const METRIC_LABEL: Record<Metric, string> = { km: "Löpning", sessions: "Pass", kg: "Lyft" };

/** Virtuella resor: stopp med ungefärligt avstånd (km) från start längs vägen. */
export const JOURNEYS: Record<string, { from: string; stops: { name: string; km: number }[] }> = {
  "sthlm-gbg": {
    from: "Stockholm",
    stops: [
      { name: "Södertälje", km: 37 },
      { name: "Norrköping", km: 165 },
      { name: "Linköping", km: 205 },
      { name: "Jönköping", km: 325 },
      { name: "Borås", km: 405 },
      { name: "Göteborg", km: 470 },
    ],
  },
  "sthlm-malmo": {
    from: "Stockholm",
    stops: [
      { name: "Norrköping", km: 165 },
      { name: "Linköping", km: 205 },
      { name: "Jönköping", km: 325 },
      { name: "Ljungby", km: 440 },
      { name: "Helsingborg", km: 555 },
      { name: "Malmö", km: 615 },
    ],
  },
};

/** Saker att jämföra lyft vikt med (kg), lättast först. */
export const WEIGHTS = [
  { name: "en flygel", plural: "flyglar", kg: 500 },
  { name: "en bil", plural: "bilar", kg: 1500 },
  { name: "en elefant", plural: "elefanter", kg: 6000 },
  { name: "en T. rex", plural: "T. rex", kg: 8000 },
  { name: "en stadsbuss", plural: "stadsbussar", kg: 12000 },
  { name: "en blåval", plural: "blåvalar", kg: 150000 },
  { name: "ett jumbojet", plural: "jumbojetar", kg: 400000 },
];

export type Preset = { theme: string | null; title: string; target: number; hint: string };

export const PRESETS: Record<Metric, Preset[]> = {
  km: [
    { theme: "sthlm-gbg", title: "Stockholm–Göteborg", target: 470, hint: "470 km" },
    { theme: "sthlm-malmo", title: "Stockholm–Malmö", target: 615, hint: "615 km" },
    { theme: null, title: "1000 km tillsammans", target: 1000, hint: "1000 km" },
  ],
  sessions: [
    { theme: null, title: "100 pass tillsammans", target: 100, hint: "100 pass" },
    { theme: null, title: "250 pass tillsammans", target: 250, hint: "250 pass" },
  ],
  kg: [
    { theme: "elefant", title: "Lyft en elefant", target: 6000, hint: "6 ton" },
    { theme: "buss", title: "Lyft en stadsbuss", target: 12000, hint: "12 ton" },
    { theme: "blaval", title: "Lyft en blåval", target: 150000, hint: "150 ton" },
  ],
};

export function formatAmount(metric: Metric, n: number): { value: string; unit: string } {
  if (metric === "km") return { value: n.toLocaleString("sv-SE", { maximumFractionDigits: n < 100 ? 1 : 0 }), unit: "km" };
  if (metric === "sessions") return { value: Math.round(n).toLocaleString("sv-SE"), unit: "pass" };
  if (n >= 1000) return { value: (n / 1000).toLocaleString("sv-SE", { maximumFractionDigits: n < 100000 ? 1 : 0 }), unit: "ton" };
  return { value: Math.round(n).toLocaleString("sv-SE"), unit: "kg" };
}

/** Var gruppen är på resan: senast passerade stopp och nästa. */
export function journeyPosition(theme: string | null, total: number) {
  const j = theme ? JOURNEYS[theme] : undefined;
  if (!j) return null;
  const passed = [...j.stops].reverse().find((s) => total >= s.km)?.name ?? j.from;
  const next = j.stops.find((s) => total < s.km) ?? null;
  return { from: j.from, stops: j.stops, passed, next, kmToNext: next ? next.km - total : 0 };
}

/** "Ni har lyft 2 elefanter" – den största saken gruppen har lyft minst en av. */
export function liftComparison(totalKg: number) {
  const w = [...WEIGHTS].reverse().find((x) => totalKg >= x.kg);
  if (!w) return null;
  const n = Math.floor(totalKg / w.kg);
  return n === 1 ? w.name : `${n.toLocaleString("sv-SE")} ${w.plural}`;
}

/** Status utifrån datum (ISO-dagar). */
export function challengeState(c: Pick<Challenge, "start_date" | "end_date">, today: string) {
  if (today < c.start_date) return "upcoming" as const;
  if (today > c.end_date) return "ended" as const;
  return "active" as const;
}

export function daysLeft(c: Pick<Challenge, "end_date">, today: string) {
  return Math.round((Date.parse(c.end_date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 864e5);
}
