-- Onboarding: det nya användare svarar på första gången, och när de var klara.
alter table public.profile
  add column if not exists onboarded_at timestamptz,
  add column if not exists current_sessions text check (current_sessions in ('0-1', '2-3', '4+')),
  add column if not exists current_km text check (current_km in ('0', '1-10', '10-25', '25-40', '40+')),
  add column if not exists gym_experience text check (gym_experience in ('ny', 'lite', 'van')),
  add column if not exists sessions_per_week smallint check (sessions_per_week between 1 and 10),
  add column if not exists available_days smallint[] check (available_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  add column if not exists gym_access text check (gym_access in ('fullt', 'hemma', 'inget'));

-- Befintliga användare har redan satt upp appen.
update public.profile set onboarded_at = now() where onboarded_at is null;
