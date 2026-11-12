import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyOverride, isRun } from "./running";
import { DISTANCES, distanceLabel } from "./goalDef";
import { isoDay } from "./dates";
import { addDays, effortsOf, formSeries, formState, predict, predictionTrend, type Effort, type RunInput } from "./prognos";

type Row = {
  sport_type: string;
  start_time: string;
  distance_m: number | null;
  distance_override_m: number | null;
  moving_time_s: number | null;
  elapsed_time_s: number | null;
  avg_hr: number | null;
  training_load: number | null;
  indoor: boolean;
  splits: { km: number; dist_m: number; time_s: number }[] | null;
};

export type Prognos = Awaited<ReturnType<typeof loadPrognos>>;

/** Loppprognos (mot målets distans, annars de vanliga) och form, ur passen de senaste månaderna. */
export async function loadPrognos(supabase: SupabaseClient, goalKm: number | null) {
  const today = isoDay();
  const from = addDays(today, -150);
  const [{ data }, { data: prof }] = await Promise.all([
    supabase
      .from("activities")
      .select("sport_type, start_time, distance_m, distance_override_m, moving_time_s, elapsed_time_s, avg_hr, training_load, indoor, splits")
      .is("deleted_at", null)
      .gte("start_time", from + "T00:00:00Z"),
    supabase.from("profile").select("resting_hr, max_hr, birth_date").maybeSingle(),
  ]);
  const rows = (data ?? []) as Row[];

  // Prognos: utomhuspass och rättade löpbandspass (löpbandets egen distans är för osäker).
  const runs: RunInput[] = rows
    .filter((r) => isRun(r.sport_type) && (!r.indoor || r.distance_override_m))
    .map((r) => {
      const a = applyOverride({ ...r, avg_pace_s_per_km: null });
      return {
        day: isoDay(new Date(r.start_time)),
        km: (Number(a.distance_m) || 0) / 1000,
        timeS: r.moving_time_s ?? r.elapsed_time_s ?? 0,
        splits: a.corrected ? null : r.splits, // rättade pass: delsträckorna stämmer inte
      };
    });
  const efforts: Effort[] = runs.flatMap(effortsOf);
  const targets = goalKm ? [goalKm, ...DISTANCES.map((d) => d.km).filter((k) => Math.abs(k - goalKm) > 0.05)] : DISTANCES.map((d) => d.km);
  const main = targets[0];
  const best = predict(efforts, main, today);
  const prediction = best
    ? {
        km: main,
        label: distanceLabel(main),
        timeS: best.timeS,
        from: best.from,
        trend: predictionTrend(efforts, main, today),
        others: targets.slice(1).map((k) => ({ km: k, label: distanceLabel(k), timeS: predict(efforts, k, today)?.timeS ?? null })),
      }
    : null;

  // Form: alla pass (löpning, gym från klockan, cykel …) med pulsbaserad belastning.
  const p = prof as { resting_hr: number | null; max_hr: number | null; birth_date: string | null } | null;
  const age = p?.birth_date ? Math.floor((Date.parse(today) - Date.parse(p.birth_date)) / (365.25 * 864e5)) : null;
  const hr = { rest: p?.resting_hr ?? 60, max: p?.max_hr ?? (age ? 220 - age : 190) };
  const sessions = rows.map((r) => ({
    day: isoDay(new Date(r.start_time)),
    minutes: (r.moving_time_s ?? r.elapsed_time_s ?? 0) / 60,
    avgHr: r.avg_hr,
    load: r.training_load,
  }));
  const series = formSeries(sessions, hr, from, today);
  const now = series.at(-1)!;
  const monthAgo = series.at(-29) ?? series[0];
  const form = rows.length
    ? {
        ...now,
        state: formState(now.form),
        fitnessChange: now.fitness - monthAgo.fitness,
        // Senaste 12 veckorna, ett värde per vecka för diagrammet.
        trend: series.slice(-84).filter((_, i, a) => (a.length - 1 - i) % 7 === 0),
      }
    : null;

  return { today, prediction, form };
}

/** Kort text till coachen. */
export function prognosText(p: Prognos, fmt: (s: number) => string) {
  const lines: string[] = [];
  if (p.prediction) {
    const pr = p.prediction;
    const first = pr.trend[0];
    lines.push(
      `Loppprognos ${pr.label}: ${fmt(pr.timeS)} (Riegel från ${pr.from.label} ${pr.from.km.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} km på ${fmt(pr.from.timeS)}, ${pr.from.day}).` +
        (first && first.day !== pr.trend.at(-1)?.day ? ` För ${Math.round((Date.parse(p.today) - Date.parse(first.day)) / 6048e5)} veckor sedan: ${fmt(first.timeS)}.` : "") +
        " Bygger på snabbaste pass senaste 8 veckorna – lugna pass ger en försiktig prognos.",
    );
  }
  if (p.form) {
    lines.push(
      `Form: ${p.form.state.label} (form ${Math.round(p.form.form)}, kondition ${Math.round(p.form.fitness)} [${p.form.fitnessChange >= 0 ? "+" : ""}${Math.round(p.form.fitnessChange)} på 4 veckor], trötthet ${Math.round(p.form.fatigue)}). Pulsbaserad belastning; >5 utvilad, −10–5 balans, −30–−10 bygger form, <−30 hög belastning.`,
    );
  }
  return lines.join("\n");
}
