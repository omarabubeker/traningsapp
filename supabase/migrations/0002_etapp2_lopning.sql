-- Etapp 2: löppass och andra pass från klockan (intervals.icu + Apple Hälsa-import).
-- Kör i Supabase → SQL Editor. Säkert att köra flera gånger.

create table if not exists public.activities (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade default auth.uid(),
  source            text not null check (source in ('intervals','apple_health','file')),
  external_id       text not null,
  sport_type        text not null,                -- 'Run', 'Walk', 'Ride', 'Strength', …
  name              text,
  start_time        timestamptz not null,
  distance_m        numeric(10,1),
  moving_time_s     integer,
  elapsed_time_s    integer,
  avg_hr            smallint,
  max_hr            smallint,
  elevation_gain_m  numeric(7,1),
  avg_pace_s_per_km numeric(7,1),
  avg_cadence       numeric(6,1),
  calories          integer,
  training_load     numeric(7,1),
  indoor            boolean not null default false,
  details_fetched   boolean not null default false, -- splits/rutt hämtade
  splits            jsonb,                         -- [{km, time_s, pace_s, hr, elev_m}]
  route             jsonb,                         -- [[lat, lng], …] förenklad
  deleted_at        timestamptz,
  source_updated_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index if not exists activities_user_start_idx on public.activities (user_id, start_time desc);

create table if not exists public.sync_state (
  user_id        uuid not null references auth.users(id) on delete cascade default auth.uid(),
  provider       text not null,
  last_sync_at   timestamptz,
  last_result    jsonb,
  primary key (user_id, provider)
);

alter table public.activities enable row level security;
alter table public.sync_state enable row level security;
drop policy if exists "egna rader" on public.activities;
create policy "egna rader" on public.activities for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "egna rader" on public.sync_state;
create policy "egna rader" on public.sync_state for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.activities, public.sync_state to authenticated;
revoke all on public.activities, public.sync_state from anon;
