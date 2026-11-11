-- Förnamn för hälsningen på översikten ("God morgon, Omar").
alter table public.profile add column if not exists display_name text check (char_length(display_name) <= 40);
