-- Kalibrering av rörelsecoachen: inspelade kroppspunkter (bara siffror, aldrig bild).
-- Används för att justera gränsvärden mot riktiga rörelser. Kan raderas när som helst.
create table if not exists public.pose_recordings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade default auth.uid(),
  movement_key  text not null,
  note          text,
  fps           numeric(5,1),
  landmarks     int[] not null,          -- vilka MediaPipe-index som sparats
  frames        jsonb not null,          -- [{t, w:[[x,y,z]…], i:[[x,y,vis]…]}]
  created_at    timestamptz not null default now()
);
alter table public.pose_recordings enable row level security;
drop policy if exists "egna rader" on public.pose_recordings;
create policy "egna rader" on public.pose_recordings for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, delete on public.pose_recordings to authenticated;
revoke all on public.pose_recordings from anon;
