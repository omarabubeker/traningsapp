-- Medlemmar med personliga inloggningslänkar. Hanteras bara av servern (service role,
-- ägaren via admin-vyn); inga rättigheter för inloggade användare eller anonyma.
create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email) and email like '%@%'),
  name          text not null check (char_length(name) between 1 and 60),
  token         text not null unique check (char_length(token) >= 32),
  user_id       uuid references auth.users(id) on delete set null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
alter table public.members enable row level security;
-- Inga policies: bara service role (servern) kommer åt tabellen.
revoke all on public.members from anon, authenticated;
