-- Mål i appen: ett huvudmål (lopp eller allmänt) och valfria delmål, med resultat när målet är klart.
create table if not exists public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind          text not null check (kind in ('race', 'general')),
  title         text not null check (char_length(title) between 1 and 80),
  distance_km   numeric(6,3) check (distance_km is null or distance_km > 0),
  race_date     date,
  target_time_s integer check (target_time_s is null or target_time_s > 0),
  start_date    date not null default current_date,
  notes         text check (notes is null or char_length(notes) <= 500),
  is_primary    boolean not null default false,
  status        text not null default 'active' check (status in ('active', 'completed', 'archived')),
  result_time_s integer check (result_time_s is null or result_time_s > 0),
  completed_at  date,
  created_at    timestamptz not null default now(),
  check (kind = 'general' or (distance_km is not null and race_date is not null))
);

-- Högst ett aktivt huvudmål per person.
create unique index if not exists goals_one_primary on public.goals (user_id) where is_primary and status = 'active';
create index if not exists goals_user_idx on public.goals (user_id, status);

alter table public.goals enable row level security;
drop policy if exists "goals_own" on public.goals;
create policy "goals_own" on public.goals for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
