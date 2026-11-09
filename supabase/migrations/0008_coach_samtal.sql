-- Coachens chatt delas upp i samtal. Ett nytt samtal startar efter varje
-- veckoavstämning, efter 12 timmars uppehåll eller när man trycker "Nytt samtal".
-- Meddelanden äldre än 90 dagar gallras (minnesanteckningarna finns kvar).
alter table public.coach_messages add column if not exists conversation_id uuid;
update public.coach_messages
  set conversation_id = md5(user_id::text || to_char(created_at at time zone 'Europe/Stockholm', 'YYYY-MM-DD'))::uuid
  where conversation_id is null;
alter table public.coach_messages alter column conversation_id set default gen_random_uuid();
alter table public.coach_messages alter column conversation_id set not null;
create index if not exists coach_messages_conv_idx on public.coach_messages (user_id, conversation_id, created_at);
