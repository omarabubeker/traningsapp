import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ageFrom, formatDate, isoDay, weekNumber } from "../dates";
import { applyOverride, formatDuration, formatPace, isRun, SPORT_LABEL } from "../running";
import { getIntervalsCreds, listWellness } from "../intervals";
import { matchWeek } from "./plan";
import { doneSessions } from "../sessions";
import { daysTo, distanceLabel, formatTime as raceTime, goalPace, type Goal } from "../goalDef";
import { MOVEMENTS } from "../movement/registry";
import type { MovementKey } from "../movement/types";
import { matchWatchToGym } from "../watchMerge";
import type { Activity, Memory, PlanItem, Profile } from "../types";

// Bygger kompakta textsammanfattningar till coachen. All räkning sker här –
// Claude får bara färdiga siffror, aldrig rådata.

const DAY = 864e5;

function mondayOf(dayIso: string) {
  const d = new Date(dayIso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const addDays = (dayIso: string, n: number) => new Date(Date.parse(dayIso + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
const r1 = (n: number) => Math.round(n * 10) / 10;
const sv = (n: number, d = 1) => n.toLocaleString("sv-SE", { maximumFractionDigits: d });

type GymRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  gym_sets: { reps: number; weight_kg: number; is_warmup: boolean; exercises: { name: string } | null }[];
};

/** Profil – ändras sällan, ligger i den cachade delen av prompten. */
export async function profileBlock(supabase: SupabaseClient) {
  const [{ data: p }, { data: w }] = await Promise.all([
    supabase.from("profile").select("*").maybeSingle(),
    supabase.from("weight_entries").select("measured_on, weight_kg").order("measured_on", { ascending: false }).limit(5),
  ]);
  const profile = p as Profile | null;
  const lines = ["## Min profil"];
  const age = ageFrom(profile?.birth_date ?? null);
  if (age !== null) lines.push(`- Ålder: ${age} år`);
  if (profile?.height_cm) lines.push(`- Längd: ${profile.height_cm} cm`);
  if (w?.length) {
    const trend = w.length > 1 ? ` (för ${w.length - 1} mätningar sedan: ${sv(Number(w.at(-1)!.weight_kg))} kg)` : "";
    lines.push(`- Vikt: ${sv(Number(w[0].weight_kg))} kg ${w[0].measured_on}${trend}`);
  }
  if (profile?.resting_hr) lines.push(`- Vilopuls: ${profile.resting_hr}`);
  if (profile?.max_hr) {
    const max = profile.max_hr;
    const z = (a: number, b: number) => `${Math.round(max * a)}–${Math.round(max * b)}`;
    lines.push(`- Maxpuls: ${max}. Pulszoner: Z1 <${Math.round(max * 0.6)}, Z2 ${z(0.6, 0.7)}, Z3 ${z(0.7, 0.8)}, Z4 ${z(0.8, 0.9)}, Z5 >${Math.round(max * 0.9)}`);
  } else if (age !== null) {
    lines.push(`- Maxpuls okänd (uppskattning 208 − 0,7 × ålder ≈ ${Math.round(208 - 0.7 * age)}, osäker)`);
  }
  if (profile?.goals) lines.push(`- Mina mål (från profilen): ${profile.goals}`);
  if (profile?.injuries) lines.push(`- Skador/begränsningar (från profilen): ${profile.injuries}`);
  return lines.join("\n");
}

export type TrainingContext = { text: string; today: string; weekStart: string };

/** Träningsläget: veckotabell, senaste passen, plan mot utfört, minne och flaggor. */
export async function trainingBlock(supabase: SupabaseClient): Promise<TrainingContext> {
  const today = isoDay();
  const thisMonday = mondayOf(today);
  const from = addDays(thisMonday, -7 * 6);
  const fromIso = new Date(Date.parse(from + "T00:00:00Z") - DAY).toISOString();

  const [{ data: acts }, { data: gyms }, { data: plans }, { data: mems }, { data: goalRows }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, sport_type, start_time, distance_m, distance_override_m, moving_time_s, elapsed_time_s, avg_hr, max_hr, avg_pace_s_per_km, elevation_gain_m, training_load, indoor, name")
      .is("deleted_at", null)
      .gte("start_time", fromIso)
      .order("start_time"),
    supabase
      .from("gym_sessions")
      .select("id, started_at, ended_at, gym_sets(reps, weight_kg, is_warmup, exercises(name))")
      .gte("started_at", fromIso)
      .order("started_at"),
    supabase
      .from("plans")
      .select("id, week_start, focus, plan_items(id, date, kind, title, description, target)")
      .eq("status", "active")
      .gte("week_start", addDays(thisMonday, -7))
      .order("week_start"),
    supabase
      .from("coach_memory")
      .select("kind, content, importance, valid_until, created_at")
      .eq("archived", false)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(40),
    supabase.from("goals").select("*").in("status", ["active", "completed"]).order("created_at"),
  ]);

  const gymSessions = ((gyms ?? []) as unknown as GymRow[]).map((g) => ({ ...g, day: isoDay(new Date(g.started_at)) }));
  // Klockans styrkepass som hör till ett loggat gympass räknas inte som eget pass;
  // pulsen läggs till gympasset i stället.
  const watchToGym = matchWatchToGym((acts ?? []) as Activity[], gymSessions);
  const gymHr = new Map<string, number>();
  for (const a of (acts ?? []) as Activity[]) {
    const g = watchToGym.get(a.id);
    if (g && a.avg_hr) gymHr.set(g, a.avg_hr);
  }
  const activities = ((acts ?? []) as Activity[])
    .filter((a) => !watchToGym.has(a.id))
    .map(applyOverride)
    .map((a) => ({ ...a, day: isoDay(new Date(a.start_time)) }));
  const runs = activities.filter((a) => isRun(a.sport_type));

  // --- Veckotabell -------------------------------------------------------------
  const weeks = Array.from({ length: 7 }, (_, i) => addDays(from, i * 7));
  const weekRows = weeks.map((ws) => {
    const we = addDays(ws, 7);
    const r = runs.filter((a) => a.day >= ws && a.day < we);
    const km = r.reduce((s, a) => s + (a.distance_m ?? 0) / 1000, 0);
    const longest = Math.max(0, ...r.map((a) => (a.distance_m ?? 0) / 1000));
    const hrRuns = r.filter((a) => a.avg_hr);
    const hr = hrRuns.length ? Math.round(hrRuns.reduce((s, a) => s + a.avg_hr!, 0) / hrRuns.length) : null;
    const time = r.reduce((s, a) => s + (a.moving_time_s ?? 0), 0);
    const g = gymSessions.filter((x) => x.day >= ws && x.day < we);
    const work = g.flatMap((x) => x.gym_sets.filter((s) => !s.is_warmup));
    const vol = work.reduce((s, x) => s + x.reps * Number(x.weight_kg), 0);
    const other = activities.filter((a) => !isRun(a.sport_type) && a.day >= ws && a.day < we).length;
    return { ws, km, n: r.length, longest, hr, time, gym: g.length, sets: work.length, vol, other, current: ws === thisMonday };
  });

  const lines: string[] = [];
  lines.push(
    `## Läget idag`,
    `- Idag: ${formatDate(today + "T12:00:00Z", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} (vecka ${weekNumber(today)})`,
    (() => {
      const left = 6 - Math.round((Date.parse(today + "T00:00:00Z") - Date.parse(thisMonday + "T00:00:00Z")) / DAY);
      return left === 0
        ? "- Idag är sista dagen i veckan (söndag). Planering gäller nästa vecka."
        : `- Dagar kvar av veckan efter idag: ${left}`;
    })(),
  );
  lines.push(...goalLines((goalRows ?? []) as Goal[], today));

  lines.push(
    "",
    "## Veckor (löpning | gym)",
    "vecka | löp km | löppass | längsta km | snittpuls löp | löptid | gympass | arbetsset | gymvolym kg | övrigt",
  );
  for (const w of weekRows) {
    lines.push(
      `v${weekNumber(w.ws)}${w.current ? " (pågår)" : ""} | ${sv(w.km)} | ${w.n} | ${sv(w.longest)} | ${w.hr ?? "–"} | ${formatDuration(w.time)} | ${w.gym} | ${w.sets} | ${Math.round(w.vol)} | ${w.other}`,
    );
  }

  // --- Senaste 14 dagarna ----------------------------------------------------
  lines.push("", "## Pass senaste 14 dagarna");
  const since14 = addDays(today, -13);
  type Entry = { day: string; t: string; text: string };
  const entries: Entry[] = [];
  for (const a of activities.filter((x) => x.day >= since14)) {
    const label = SPORT_LABEL[a.sport_type] ?? a.sport_type;
    const parts = [label + (a.indoor ? " inomhus" : "") + (a.corrected ? " (distans rättad från löpbandet)" : "")];
    if (a.distance_m) parts.push(`${sv(a.distance_m / 1000, 2)} km`);
    if (a.moving_time_s) parts.push(formatDuration(a.moving_time_s));
    if (isRun(a.sport_type) && a.avg_pace_s_per_km) parts.push(`${formatPace(a.avg_pace_s_per_km)}/km`);
    if (a.avg_hr) parts.push(`puls ${a.avg_hr}${a.max_hr ? `/${a.max_hr}` : ""}`);
    if (a.elevation_gain_m) parts.push(`+${Math.round(a.elevation_gain_m)} m`);
    entries.push({ day: a.day, t: a.start_time, text: parts.join(", ") });
  }
  for (const g of gymSessions.filter((x) => x.day >= since14)) {
    const byEx = new Map<string, string[]>();
    for (const s of g.gym_sets.filter((x) => !x.is_warmup)) {
      const name = s.exercises?.name ?? "?";
      byEx.set(name, [...(byEx.get(name) ?? []), `${sv(Number(s.weight_kg))}×${s.reps}`]);
    }
    const text = [...byEx].map(([n, s]) => `${n} ${s.join(" ")}`).join("; ");
    const hr = gymHr.get(g.id);
    entries.push({ day: g.day, t: g.started_at, text: `Gym: ${text || "inga set"}${hr ? ` (snittpuls ${hr} enligt klockan)` : ""}` });
  }
  entries.sort((a, b) => a.t.localeCompare(b.t));
  if (!entries.length) lines.push("- Inga pass.");
  for (const e of entries) lines.push(`- ${formatDate(e.day + "T12:00:00Z", { weekday: "short", day: "numeric", month: "short" })}: ${e.text}`);

  // --- Gymutveckling: bästa set per övning, senaste vs 4+ veckor sedan ---------
  const exBest = new Map<string, { recent: string; old: string | null }>();
  const fourWeeksAgo = addDays(today, -28);
  const e1rm = (w: number, r: number) => w * (1 + r / 30);
  const best = (sets: { reps: number; weight_kg: number }[]) =>
    sets.reduce<{ w: number; r: number } | null>((b, s) => {
      const w = Number(s.weight_kg);
      return !b || e1rm(w, s.reps) > e1rm(b.w, b.r) ? { w, r: s.reps } : b;
    }, null);
  const exNames = new Set(gymSessions.flatMap((g) => g.gym_sets.map((s) => s.exercises?.name ?? "?")));
  for (const name of exNames) {
    const sets = (filter: (d: string) => boolean) =>
      gymSessions.filter((g) => filter(g.day)).flatMap((g) => g.gym_sets.filter((s) => !s.is_warmup && s.exercises?.name === name));
    const recent = best(sets((d) => d >= fourWeeksAgo));
    const old = best(sets((d) => d < fourWeeksAgo));
    if (recent) exBest.set(name, { recent: `${sv(recent.w)}×${recent.r}`, old: old ? `${sv(old.w)}×${old.r}` : null });
  }
  if (exBest.size) {
    lines.push("", "## Gym: bästa set senaste 4 veckorna (jämfört med tidigare)");
    for (const [n, v] of exBest) lines.push(`- ${n}: ${v.recent}${v.old ? ` (tidigare ${v.old})` : ""}`);
  }

  // --- Plan mot utfört ---------------------------------------------------------
  // Planen matchas per vecka: ett pass som flyttats till en annan dag samma vecka räknas som gjort.
  const sessions = doneSessions(activities, gymSessions.map((g) => g.started_at));
  type P = { week_start: string; focus: string | null; plan_items: Pick<PlanItem, "id" | "date" | "kind" | "title" | "description" | "target">[] };
  const planRows = (plans ?? []) as P[];
  let missed = 0;
  if (planRows.length) {
    lines.push("", "## Plan mot utfört");
    for (const p of planRows) {
      lines.push(`Vecka ${weekNumber(p.week_start)}${p.focus ? ` – fokus: ${p.focus}` : ""}`);
      const match = matchWeek(p.plan_items, sessions, p.week_start, today);
      for (const it of [...p.plan_items].sort((a, b) => a.date.localeCompare(b.date))) {
        const { status: st, doneDay } = match.get(it.id)!;
        if (st === "missed") missed++;
        const moved = st === "done" && doneDay && doneDay !== it.date ? ` (gjort ${formatDate(doneDay + "T12:00:00Z", { weekday: "short" })})` : "";
        const label = { done: "✓ gjort", missed: "✗ missat", today: "→ idag", upcoming: "kommande", rest: "vila", pending: "kvar i veckan" }[st];
        lines.push(`- ${formatDate(it.date + "T12:00:00Z", { weekday: "short", day: "numeric", month: "short" })} ${it.title} [${label}${moved}]`);
      }
    }
  } else {
    lines.push("", "## Plan", "- Ingen aktiv plan ännu.");
  }

  // --- Återhämtning från klockan (intervals.icu wellness) ------------------------
  const { data: who } = await supabase.auth.getClaims();
  const creds = await getIntervalsCreds(supabase, who?.claims?.email as string | undefined);
  if (creds) {
    try {
      const well = await listWellness(creds, addDays(today, -13), today);
      const withData = well.filter((w) => w.restingHR || w.hrv || w.sleepSecs);
      if (withData.length) {
        const avg = (xs: (number | null)[]) => {
          const v = xs.filter((x): x is number => !!x);
          return v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null;
        };
        const last7 = withData.filter((w) => w.id >= addDays(today, -6));
        const prev7 = withData.filter((w) => w.id < addDays(today, -6));
        const fmt = (label: string, a: number | null, b: number | null, unit = "") =>
          a !== null ? `- ${label}: ${sv(a)}${unit} senaste 7 d${b !== null ? ` (veckan innan ${sv(b)}${unit})` : ""}` : null;
        lines.push(
          "",
          "## Återhämtning (från klockan)",
          ...[
            fmt("Vilopuls", avg(last7.map((w) => w.restingHR)), avg(prev7.map((w) => w.restingHR))),
            fmt("HRV", avg(last7.map((w) => w.hrv)), avg(prev7.map((w) => w.hrv)), " ms"),
            fmt("Sömn", avg(last7.map((w) => (w.sleepSecs ? w.sleepSecs / 3600 : null))), avg(prev7.map((w) => (w.sleepSecs ? w.sleepSecs / 3600 : null))), " h"),
          ].filter((x): x is string => !!x),
        );
      }
    } catch {
      /* wellness är frivilligt */
    }
  }

  // --- Teknik från rörelsecoachen (kamera) ---------------------------------------------
  const { data: tech } = await supabase
    .from("technique_results")
    .select("movement_key, reps, good_reps, hold_s, faults, metrics, created_at")
    .gte("created_at", new Date(Date.parse(today + "T00:00:00Z") - 56 * DAY).toISOString());
  if (tech?.length) {
    lines.push("", "## Teknik (rörelsecoach med kamera, senaste 4 veckorna jämfört med veckorna innan)");
    const cut = new Date(Date.parse(today + "T00:00:00Z") - 28 * DAY).toISOString();
    for (const key of Object.keys(MOVEMENTS) as MovementKey[]) {
      const rows = tech.filter((t) => t.movement_key === key);
      if (!rows.length) continue;
      const rule = MOVEMENTS[key];
      const agg = (xs: typeof rows) => {
        const reps = xs.reduce((s2, x) => s2 + x.reps, 0);
        const good = xs.reduce((s2, x) => s2 + x.good_reps, 0);
        const hold = xs.reduce((s2, x) => s2 + (x.hold_s ?? 0), 0);
        const faults: Record<string, number> = {};
        for (const x of xs) for (const [f, n] of Object.entries((x.faults ?? {}) as Record<string, number>)) faults[f] = (faults[f] ?? 0) + n;
        return { sets: xs.length, reps, good, hold, faults };
      };
      const recent = agg(rows.filter((r) => r.created_at >= cut));
      const before = agg(rows.filter((r) => r.created_at < cut));
      const pct = (a: { reps: number; good: number }) => (a.reps ? `${Math.round((a.good / a.reps) * 100)} %` : "–");
      const top = Object.entries(recent.faults).sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([f, n]) => `${(rule.faultLabels[f] ?? f).toLowerCase()} (${n}${rule.kind === "hold" ? " s" : ""})`);
      const main = rule.kind === "hold"
        ? `${recent.sets} set, total hålltid ${recent.hold} s`
        : `${recent.sets} set, ${recent.reps} reps, god teknik ${pct(recent)}`;
      const prev = before.sets
        ? rule.kind === "hold" ? ` (innan: ${before.hold} s)` : ` (innan: ${pct(before)} av ${before.reps} reps)`
        : "";
      lines.push(`- ${rule.name}: ${recent.sets ? main : "inget senaste 4 v"}${prev}${top.length ? `. Vanligaste fel: ${top.join(", ")}` : ""}`);
    }
  }

  // --- Flaggor -------------------------------------------------------------------
  const flags: string[] = [];
  const done = weekRows.filter((w) => !w.current);
  const lastFull = done.at(-1);
  const prev4 = done.slice(-5, -1);
  if (lastFull && prev4.length) {
    const avg4 = prev4.reduce((s, w) => s + w.km, 0) / prev4.length;
    if (avg4 > 0) {
      const ratio = lastFull.km / avg4;
      if (ratio > 1.3) flags.push(`Löpvolymen förra veckan var ${Math.round((ratio - 1) * 100)} % över 4-veckorssnittet (${sv(avg4)} km).`);
      if (ratio < 0.6) flags.push(`Löpvolymen förra veckan var låg jämfört med 4-veckorssnittet (${sv(avg4)} km).`);
    }
  }
  if (missed >= 2) flags.push(`${missed} planerade pass missade.`);
  const memories = ((mems ?? []) as Memory[]).filter((m) => !m.valid_until || m.valid_until >= today);
  const recentFeedback = memories.filter((m) => m.kind === "feedback" && m.created_at >= addDays(today, -7));
  if (recentFeedback.some((m) => /trött|sliten|sov dåligt|sjuk|ont|öm|smärta/i.test(m.content))) {
    flags.push("Återkoppling senaste veckan tyder på trötthet eller känningar.");
  }
  if (flags.length) lines.push("", "## Flaggor", ...flags.map((f) => `- ${f}`));

  // --- Minne -------------------------------------------------------------------------
  const picked = [
    ...memories.filter((m) => m.kind === "injury_note" || m.kind === "goal" || m.kind === "preference"),
    ...memories.filter((m) => m.kind === "feedback" && m.created_at >= addDays(today, -14)),
    ...memories.filter((m) => m.kind === "advice" || m.kind === "plan_decision"),
  ];
  const unique = [...new Map(picked.map((m) => [m.content, m])).values()].slice(0, 15);
  if (unique.length) {
    const KIND = { advice: "råd", plan_decision: "beslut", feedback: "återkoppling", injury_note: "skada", preference: "preferens", goal: "mål" };
    lines.push("", "## Minne (tidigare råd och återkopplingar)");
    for (const m of unique) lines.push(`- [${KIND[m.kind]}, ${m.created_at.slice(0, 10)}] ${m.content}`);
  }

  return { text: lines.filter((l) => l !== "").join("\n").replace(/\n## /g, "\n\n## "), today, weekStart: thisMonday };
}

/** Målen i klartext för coachen: huvudmål (med dagar kvar och måltempo), delmål och senaste resultat. */
function goalLines(goals: Goal[], today: string): string[] {
  const out: string[] = ["", "## Mål (från appen – detta gäller före instruktionsfilen)"];
  const primary = goals.find((g) => g.is_primary && g.status === "active");
  if (!primary) out.push("- Inget huvudmål är satt. Föreslå gärna att jag sätter ett under Mål i appen.");
  else if (primary.kind === "race" && primary.distance_km) {
    const km = Number(primary.distance_km);
    const days = daysTo(primary, today);
    const pace = goalPace({ distance_km: km, target_time_s: primary.target_time_s });
    out.push(
      `- Huvudmål: ${primary.title} (${distanceLabel(km)}, ${km.toLocaleString("sv-SE")} km) den ${primary.race_date}` +
        (primary.target_time_s ? `, måltid ${raceTime(primary.target_time_s)} (${Math.floor(pace! / 60)}:${String(Math.round(pace! % 60)).padStart(2, "0")}/km)` : ", ingen måltid satt"),
      days !== null && days >= 0 ? `- Dagar kvar till loppet: ${days} (${Math.floor(days / 7)} veckor)` : "- Loppdatumet har passerat – fråga hur det gick och hjälp mig välja nästa mål.",
      `- Uppladdningen startade ${primary.start_date}.`,
    );
  } else out.push(`- Huvudmål: ${primary.title}${primary.notes ? ` – ${primary.notes}` : ""} (sedan ${primary.start_date})`);
  for (const g of goals.filter((x) => !x.is_primary && x.status === "active")) out.push(`- Delmål: ${g.title}${g.notes ? ` – ${g.notes}` : ""}`);
  const done = goals.filter((g) => g.status === "completed" && g.completed_at).sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))[0];
  if (done) out.push(`- Senast avklarat: ${done.title} ${done.completed_at}${done.result_time_s ? `, tid ${raceTime(done.result_time_s)}` : ""}`);
  return out;
}
