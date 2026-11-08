-- Etapp 3: coach – samtal, minne, planer och förbrukning.
-- Kör i Supabase → SQL Editor. Säkert att köra flera gånger.

create table if not exists public.coach_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  role        text not null check (role in ('user','assistant')),
  kind        text not null default 'chat' check (kind in ('chat','weekly')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists coach_messages_user_idx on public.coach_messages (user_id, created_at desc);

create table if not exists public.coach_memory (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind              text not null check (kind in ('advice','plan_decision','feedback','injury_note','preference','goal')),
  content           text not null,
  importance        smallint not null default 2 check (importance between 1 and 3),
  valid_until       date,
  archived          boolean not null default false,
  source_message_id uuid references public.coach_messages(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists coach_memory_user_idx on public.coach_memory (user_id, archived, created_at desc);

create table if not exists public.plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  week_start  date not null,
  status      text not null default 'active' check (status in ('active','archived')),
  summary     text,
  focus       text,
  model       text,
  created_at  timestamptz not null default now()
);
create index if not exists plans_user_week_idx on public.plans (user_id, week_start desc);

create table if not exists public.plan_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  plan_id     uuid not null references public.plans(id) on delete cascade,
  date        date not null,
  kind        text not null check (kind in ('run','gym','rest','other')),
  title       text not null,
  description text,
  target      jsonb,
  sort        smallint not null default 0
);
create index if not exists plan_items_plan_idx on public.plan_items (plan_id, date, sort);

create table if not exists public.llm_usage (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind               text not null,
  model              text not null,
  input_tokens       integer not null default 0,
  cache_read_tokens  integer not null default 0,
  cache_write_tokens integer not null default 0,
  output_tokens      integer not null default 0,
  cost_usd           numeric(10,6) not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists llm_usage_user_idx on public.llm_usage (user_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['coach_messages','coach_memory','plans','plan_items','llm_usage'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "egna rader" on public.%I', t);
    execute format(
      'create policy "egna rader" on public.%I for all to authenticated
         using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
