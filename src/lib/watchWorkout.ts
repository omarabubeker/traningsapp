// Gör om ett löppass i planen till ett strukturerat pass i intervals.icu-format,
// som Companion-appen sedan skickar till klockan.
//
// Format (intervals.icu): rader som börjar med "-" är steg, "4x" före en grupp upprepar den,
// övriga rader är rubriker/anteckningar. T.ex. "- 10m Z2 HR", "- 2km 5:20-5:30/km Pace", "- 400mtr …".

type Target = { distance_km?: number | null; duration_min?: number | null; intensity?: string | null; workout?: string | null };
type Item = { date: string; kind: string; title: string; description: string | null; target: Record<string, unknown> | null };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

/** Läser ut ett tempo som "ca 6:20/km" eller "6:10–6:30/km" ur fritext. Sekunder per km. */
export function parsePace(text: string | null | undefined): { lo: number; hi: number } | null {
  if (!text) return null;
  const m = text.match(/(\d{1,2}):(\d{2})\s*(?:[–-]\s*(\d{1,2}):(\d{2}))?\s*\/\s*km/);
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2]);
  const b = m[3] ? Number(m[3]) * 60 + Number(m[4]) : null;
  if (b === null) return { lo: a - 10, hi: a + 10 };
  return { lo: Math.min(a, b), hi: Math.max(a, b) };
}

/** Enkelt pass när coachen inte gav några steg: hela passet med tempo eller pulszon som mål. */
export function simpleSteps(t: Target): string | null {
  const len = t.distance_km ? `${Math.round(t.distance_km * 10) / 10}km` : t.duration_min ? `${Math.round(t.duration_min)}m` : null;
  if (!len) return null;
  const pace = parsePace(t.intensity);
  const zone = t.intensity?.match(/\bZ([1-5])\b/i)?.[1];
  const aim = pace ? ` ${mmss(pace.lo)}-${mmss(pace.hi)}/km Pace` : zone ? ` Z${zone} HR` : "";
  return `- ${len}${aim}`;
}

/** Ser ut som intervals-steg (minst en rad "- …"). */
const looksLikeSteps = (s: string) => /^\s*-\s+\S/m.test(s);

/** Det som skickas till kalendern för ett löppass, eller null om passet inte ska till klockan. */
export function plannedWorkout(item: Item): { date: string; name: string; description: string } | null {
  if (item.kind !== "run") return null;
  const t = (item.target ?? {}) as Target;
  const steps = t.workout && looksLikeSteps(t.workout) ? t.workout.trim() : simpleSteps(t);
  const notes = [item.description, t.intensity].filter(Boolean).join("\n");
  return {
    date: item.date,
    name: item.title.slice(0, 80),
    description: [notes, steps].filter(Boolean).join("\n\n"),
  };
}

/** Kort fingeravtryck av det som skickades, så att bara ändrade pass skickas om. */
export function workoutHash(w: { date: string; name: string; description: string }) {
  const s = `${w.date}|${w.name}|${w.description}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
