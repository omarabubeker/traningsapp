-- Gruppchallenger: ägaren skapar (via servern), alla ser, var och en går med själv.
-- Bara gruppens totalsumma visas – ingen ser andras siffror.

create table if not exists public.challenges (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 60),
  metric     text not null check (metric in ('km', 'sessions', 'kg')),
  target     numeric not null check (target > 0),
  theme      text check (theme is null or char_length(theme) <= 40),  -- t.ex. 'sthlm-gbg', 'blaval'
  start_date date not null,
  end_date   date not null,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.challenge_members (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

alter table public.challenges enable row level security;
alter table public.challenge_members enable row level security;

create policy "alla inloggade läser" on public.challenges for select to authenticated using (true);

create policy "egen rad" on public.challenge_members for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Behörigheter sätts uttryckligen (projektet ger dem inte automatiskt).
grant select on public.challenges to authenticated;
grant select, insert, delete on public.challenge_members to authenticated;
grant select, insert, update, delete on public.challenges, public.challenge_members to service_role;

-- Framsteg för aktuella challenger: gruppens summa, antal deltagare och ens eget bidrag.
-- security definer eftersom summan bygger på allas pass; bara aggregat lämnar funktionen.
create or replace function public.challenge_progress()
returns table (challenge_id uuid, total numeric, participants integer, mine numeric, joined boolean)
language sql stable security definer set search_path = '' as $$
  with ch as (
    select * from public.challenges
    where end_date >= (now() at time zone 'Europe/Stockholm')::date - 14
  ),
  runs as (
    select a.user_id, (a.start_time at time zone 'Europe/Stockholm')::date as day,
           coalesce(a.distance_override_m, a.distance_m, 0) / 1000.0 as km
    from public.activities a
    where a.deleted_at is null and a.sport_type ~* 'run'
  ),
  gym as (
    select g.user_id, (g.started_at at time zone 'Europe/Stockholm')::date as day, g.id
    from public.gym_sessions g
  ),
  watch_strength as (  -- styrkepass från klockan som inte loggats i appen samma dag
    select a.user_id, (a.start_time at time zone 'Europe/Stockholm')::date as day
    from public.activities a
    where a.deleted_at is null and a.sport_type ~* '^(strength|weighttraining)$'
      and not exists (select 1 from public.gym_sessions g where g.user_id = a.user_id
                      and (g.started_at at time zone 'Europe/Stockholm')::date = (a.start_time at time zone 'Europe/Stockholm')::date)
  ),
  per_user as (
    select c.id as cid, m.user_id,
      case c.metric
        when 'km' then (select coalesce(sum(r.km), 0) from runs r where r.user_id = m.user_id and r.day between c.start_date and c.end_date)
        when 'sessions' then
          (select count(*) from runs r where r.user_id = m.user_id and r.day between c.start_date and c.end_date)
          + (select count(*) from gym x where x.user_id = m.user_id and x.day between c.start_date and c.end_date)
          + (select count(*) from watch_strength w where w.user_id = m.user_id and w.day between c.start_date and c.end_date)
        else
          (select coalesce(sum(s.reps * s.weight_kg), 0) from public.gym_sets s join gym x on x.id = s.session_id
           where s.user_id = m.user_id and not s.is_warmup and x.day between c.start_date and c.end_date)
      end::numeric as amount
    from ch c join public.challenge_members m on m.challenge_id = c.id
  )
  select c.id,
    coalesce((select sum(p.amount) from per_user p where p.cid = c.id), 0),
    (select count(*)::int from per_user p where p.cid = c.id),
    coalesce((select p.amount from per_user p where p.cid = c.id and p.user_id = (select auth.uid())), 0),
    exists (select 1 from per_user p where p.cid = c.id and p.user_id = (select auth.uid()))
  from ch c;
$$;
revoke all on function public.challenge_progress() from public, anon;
grant execute on function public.challenge_progress() to authenticated;
