-- Pushnotiser: telefonernas prenumerationer, val per person och logg över skickade medaljnotiser.
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "egna rader" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

alter table public.profile add column if not exists notify_weekly boolean not null default true;
alter table public.profile add column if not exists notify_medals boolean not null default true;

create table if not exists public.challenge_notified (
  challenge_id uuid primary key references public.challenges(id) on delete cascade,
  notified_at  timestamptz not null default now()
);
alter table public.challenge_notified enable row level security;
grant select, insert on public.challenge_notified to service_role;

-- Servern (schemalagt jobb) behöver läsa profiler, planer, deltagare och framsteg.
grant select on public.profile, public.plans, public.challenge_members, public.challenges to service_role;
grant execute on function public.challenge_progress() to service_role;
