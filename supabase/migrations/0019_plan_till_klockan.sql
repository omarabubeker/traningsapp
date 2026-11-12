-- Löppass i planen skickas till intervals.icu-kalendern (och vidare till klockan).
-- watch_event_id: passets id i intervals-kalendern; watch_hash: vad som senast skickades
-- (så att bara ändrade pass skickas om).
alter table public.plan_items add column if not exists watch_event_id text;
alter table public.plan_items add column if not exists watch_hash text;
