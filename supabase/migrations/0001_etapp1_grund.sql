-- Etapp 1: profil, vikt och gymlogg.
-- Kör i Supabase → SQL Editor (eller `supabase db push`).
-- Alla tabeller har Row Level Security: bara inloggad ägare ser och ändrar sina rader.

create extension if not exists pgcrypto;

-- Profil ------------------------------------------------------------------
create table if not exists public.profile (
  user_id     uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  height_cm   numeric(5,1),
  birth_date  date,
  resting_hr  smallint check (resting_hr between 25 and 120),
  max_hr      smallint check (max_hr between 120 and 240),
  goals       text,
  injuries    text,
  updated_at  timestamptz not null default now()
);

create table if not exists public.weight_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  measured_on date not null default current_date,
  weight_kg   numeric(5,1) not null check (weight_kg between 30 and 300),
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- Gym ----------------------------------------------------------------------
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name          text not null,
  muscle_group  text,
  is_bodyweight boolean not null default false,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);
create unique index if not exists exercises_user_name_idx on public.exercises (user_id, lower(name));

create table if not exists public.gym_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists gym_sessions_user_started_idx on public.gym_sessions (user_id, started_at desc);

create table if not exists public.gym_sets (
  id          uuid primary key default gen_random_uuid(),   -- klienten genererar id → säkra omförsök offline
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  session_id  uuid not null references public.gym_sessions(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_no      smallint not null default 1,
  reps        smallint not null check (reps between 0 and 200),
  weight_kg   numeric(6,2) not null default 0 check (weight_kg between 0 and 1000),
  rpe         numeric(3,1) check (rpe between 1 and 10),
  is_warmup   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists gym_sets_session_idx on public.gym_sets (session_id, created_at);
create index if not exists gym_sets_exercise_idx on public.gym_sets (user_id, exercise_id, created_at desc);

-- RLS ----------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profile','weight_entries','exercises','gym_sessions','gym_sets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "egna rader" on public.%I', t);
    execute format(
      'create policy "egna rader" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- "Förra gången": senaste avslutade/tidigare pass med övningen, före angivet pass.
create or replace function public.previous_sets(p_exercise_id uuid, p_before_session uuid)
returns setof public.gym_sets
language sql stable security invoker as $$
  with prev as (
    select s.session_id
    from public.gym_sets s
    join public.gym_sessions g on g.id = s.session_id
    where s.exercise_id = p_exercise_id
      and s.session_id <> p_before_session
      and s.user_id = (select auth.uid())
    order by g.started_at desc
    limit 1
  )
  select s.* from public.gym_sets s
  where s.session_id = (select session_id from prev) and s.exercise_id = p_exercise_id
  order by s.created_at;
$$;

-- Startövningar skapas för nya användare (kan ändras/arkiveras i appen).
create or replace function public.seed_exercises()
returns void language sql security invoker as $$
  insert into public.exercises (name, muscle_group, is_bodyweight) values
    ('Knäböj','Ben',false), ('Marklyft','Baksida',false), ('Bänkpress','Bröst',false),
    ('Militärpress','Axlar',false), ('Skivstångsrodd','Rygg',false), ('Chins','Rygg',true),
    ('Utfall','Ben',false), ('Rumänsk marklyft','Baksida',false), ('Hip thrust','Säte',false),
    ('Vadpress','Vader',false), ('Plankan (sek)','Bål',true), ('Dips','Bröst',true)
  on conflict do nothing;
$$;
