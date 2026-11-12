-- Mål är inte bara lopp: styrkemål (övning + målvikt) och vad man vill träna.
alter table public.goals
  add column if not exists focus text not null default 'general' check (focus in ('run', 'strength', 'general')),
  add column if not exists exercise text check (exercise is null or char_length(exercise) <= 60),
  add column if not exists target_kg numeric(6,2) check (target_kg is null or target_kg > 0);
update public.goals set focus = 'run' where kind = 'race';

alter table public.profile
  add column if not exists training_focus text check (training_focus in ('run', 'strength', 'both'));
