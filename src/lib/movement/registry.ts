import type { MovementKey, MovementRule } from "./types";
import { squat } from "./exercises/squat";
import { lunge } from "./exercises/lunge";
import { plank } from "./exercises/plank";

// Ny övning: skriv en regelmodul i exercises/ och lägg till den här.
export const MOVEMENTS: Record<MovementKey, MovementRule<never>> = {
  squat: squat as MovementRule<never>,
  lunge: lunge as MovementRule<never>,
  plank: plank as MovementRule<never>,
};

export const MOVEMENT_LIST = Object.values(MOVEMENTS);
