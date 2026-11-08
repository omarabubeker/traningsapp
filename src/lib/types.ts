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
