-- Egen klockkoppling per person: intervals.icu athlete-id + API-nyckel.
-- Nyckeln lagras krypterad i Supabase Vault; tabellen innehåller bara en referens.
-- Allt skrivs via funktionerna nedan (security definer), som bara rör den inloggades egen rad.

create table if not exists public.watch_connections (
  user_id      uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  provider     text not null default 'intervals' check (provider = 'intervals'),
  athlete_id   text not null check (athlete_id ~ '^i[0-9]+$'),
  athlete_name text check (athlete_name is null or char_length(athlete_name) <= 120),
  brand        text check (brand in ('apple', 'garmin', 'polar', 'coros', 'suunto', 'wahoo', 'other')),
  secret_id    uuid not null,
  connected_at timestamptz not null default now()
);

alter table public.watch_connections enable row level security;
drop policy if exists "egen rad, läsa" on public.watch_connections;
create policy "egen rad, läsa" on public.watch_connections for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.save_intervals_connection(p_athlete text, p_key text, p_brand text, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then raise exception 'inte inloggad'; end if;
  if p_key is null or char_length(p_key) not between 10 and 200 then raise exception 'ogiltig nyckel'; end if;
  select secret_id into sid from public.watch_connections where user_id = uid;
  if sid is null then
    sid := vault.create_secret(p_key, 'intervals:' || uid::text, 'intervals.icu API-nyckel');
  else
    perform vault.update_secret(sid, p_key);
  end if;
  insert into public.watch_connections (user_id, athlete_id, brand, secret_id, athlete_name)
  values (uid, p_athlete, p_brand, sid, p_name)
  on conflict (user_id) do update
    set athlete_id = excluded.athlete_id, brand = excluded.brand, athlete_name = excluded.athlete_name, connected_at = now();
end $$;

create or replace function public.intervals_credentials()
returns table (athlete_id text, api_key text) language sql stable security definer set search_path = '' as $$
  select c.athlete_id, s.decrypted_secret
  from public.watch_connections c
  join vault.decrypted_secrets s on s.id = c.secret_id
  where c.user_id = auth.uid();
$$;

create or replace function public.delete_intervals_connection()
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then raise exception 'inte inloggad'; end if;
  select secret_id into sid from public.watch_connections where user_id = uid;
  delete from public.watch_connections where user_id = uid;
  if sid is not null then delete from vault.secrets where id = sid; end if;
end $$;

revoke all on function public.save_intervals_connection(text, text, text, text) from public, anon;
revoke all on function public.intervals_credentials() from public, anon;
revoke all on function public.delete_intervals_connection() from public, anon;
grant execute on function public.save_intervals_connection(text, text, text, text) to authenticated;
grant execute on function public.intervals_credentials() to authenticated;
grant execute on function public.delete_intervals_connection() to authenticated;
