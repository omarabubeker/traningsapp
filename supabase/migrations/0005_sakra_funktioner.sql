-- Säkerhet: fast search_path för databasfunktionerna (Supabase advisor 0011).
-- Funktionerna använder redan fullständiga namn (public.…, auth.uid()).
alter function public.seed_exercises() set search_path = '';
alter function public.previous_sets(uuid, uuid) set search_path = '';
