-- Rörelsecoachen: armhävningar och marklyft.
alter table public.exercises drop constraint if exists exercises_movement_key_check;
alter table public.exercises add constraint exercises_movement_key_check
  check (movement_key is null or movement_key in ('squat','lunge','plank','pushup','deadlift'));
alter table public.technique_results drop constraint if exists technique_results_movement_key_check;
alter table public.technique_results add constraint technique_results_movement_key_check
  check (movement_key in ('squat','lunge','plank','pushup','deadlift'));
update public.exercises set movement_key = 'deadlift' where lower(name) = 'marklyft' and movement_key is null;
update public.exercises set movement_key = 'pushup' where lower(name) in ('armhävningar','push-ups','pushups') and movement_key is null;
