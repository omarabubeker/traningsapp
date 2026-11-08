export type Profile = {
  user_id: string;
  height_cm: number | null;
  birth_date: string | null;
  resting_hr: number | null;
  max_hr: number | null;
  goals: string | null;
  injuries: string | null;
  updated_at: string;
};

export type WeightEntry = { id: string; measured_on: string; weight_kg: number };

export type Exercise = {
  id: string;
  name: string;
  muscle_group: string | null;
  is_bodyweight: boolean;
  archived: boolean;
};

export type GymSession = {
  id: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
};

export type GymSet = {
  id: string;
  session_id: string;
  exercise_id: string;
  set_no: number;
  reps: number;
  weight_kg: number;
  rpe: number | null;
  is_warmup: boolean;
  created_at: string;
};

export type Split = { km: number; dist_m: number; time_s: number; pace_s: number; hr: number | null; elev_m: number | null };

export type Activity = {
  id: string;
  source: "intervals" | "apple_health" | "file";
  external_id: string;
  sport_type: string;
  name: string | null;
  start_time: string;
  distance_m: number | null;
  moving_time_s: number | null;
  elapsed_time_s: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  elevation_gain_m: number | null;
  avg_pace_s_per_km: number | null;
  avg_cadence: number | null;
  calories: number | null;
  training_load: number | null;
  indoor: boolean;
  splits: Split[] | null;
  route: [number, number][] | null;
};
