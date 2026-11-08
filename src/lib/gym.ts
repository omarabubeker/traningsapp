// Beräkningar för gymutveckling.

/** Uppskattat 1RM (Epley). Används för att jämföra set med olika vikt och reps. */
export function e1rm(weight: number, reps: number) {
  if (reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export type SetLike = { weight_kg: number | string; reps: number; is_warmup: boolean };

/** Bästa arbetsset (högst e1RM, eller flest reps för kroppsviktsövningar). */
export function bestSet<T extends SetLike>(sets: T[], bodyweight: boolean): T | null {
  const work = sets.filter((s) => !s.is_warmup);
  return work.reduce<T | null>((best, s) => {
    if (!best) return s;
    const score = (x: T) => (bodyweight && Number(x.weight_kg) === 0 ? x.reps : e1rm(Number(x.weight_kg), x.reps));
    return score(s) > score(best) ? s : best;
  }, null);
}
