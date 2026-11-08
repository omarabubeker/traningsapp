-- Etapp 5: rörelsecoach med kamera. Bara siffror sparas – aldrig bild eller video.
-- Kör i Supabase → SQL Editor. Säkert att köra flera gånger.

-- Koppling mellan gymövning och kameraregel.
alter table public.exercises add column if not exists movement_key text
  check (movement_key is null or movement_key in ('squat','lunge','plank'));
create unique index if not exists exercises_user_movement_idx on public.exercises (user_id, movement_key) where movement_key is not null;

update public.exercises set movement_key = 'squat' where lower(name) = 'knäböj' and movement_key is null;
update public.exercises set movement_key = 'plank', name = 'Planka' where lower(name) like 'plank%' and movement_key is null;
update public.exercises set name = 'Utfallssteg', movement_key = 'lunge'
  where lower(name) = 'utfall' and movement_key is null
    and not exists (select 1 from public.exercises e2 where e2.user_id = exercises.user_id and lower(e2.name) = 'utfallssteg');
update public.exercises set movement_key = 'lunge' where lower(name) = 'utfallssteg' and movement_key is null;

-- Hålltid för tidsövningar (planka).
alter table public.gym_sets add column if not exists duration_s integer check (duration_s is null or duration_s between 0 and 36000);
-- Var passet loggades.
alter table public.gym_sessions add column if not exists source text not null default 'manual' check (source in ('manual','camera'));

-- Teknikresultat per kameraset.
create table if not exists public.technique_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  gym_set_id    uuid references public.gym_sets(id) on delete set null,
  movement_key  text not null check (movement_key in ('squat','lunge','plank')),
  reps          integer not null default 0,
  good_reps     integer not null default 0,
  hold_s        integer,
  faults        jsonb not null default '{}'::jsonb,   -- {"knees_in": 3, "shallow": 1}
  metrics       jsonb not null default '{}'::jsonb,   -- {"avg_depth": 92, ...}
  model         text,
  created_at    timestamptz not null default now()
);
create index if not exists technique_results_user_idx on public.technique_results (user_id, movement_key, created_at desc);

alter table public.technique_results enable row level security;
drop policy if exists "egna rader" on public.technique_results;
create policy "egna rader" on public.technique_results for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.technique_results to authenticated;
revoke all on public.technique_results from anon;

-- Startövningar för nya konton får kameranycklar.
create or replace function public.seed_exercises()
returns void language sql security invoker set search_path = '' as $$
  insert into public.exercises (name, muscle_group, is_bodyweight, movement_key) values
    ('Knäböj','Ben',false,'squat'), ('Marklyft','Baksida',false,null), ('Bänkpress','Bröst',false,null),
    ('Militärpress','Axlar',false,null), ('Skivstångsrodd','Rygg',false,null), ('Chins','Rygg',true,null),
    ('Utfallssteg','Ben',false,'lunge'), ('Rumänsk marklyft','Baksida',false,null), ('Hip thrust','Säte',false,null),
    ('Vadpress','Vader',false,null), ('Planka','Bål',true,'plank'), ('Dips','Bröst',true,null)
  on conflict do nothing;
$$;
