-- Etapp 4: manuellt rättad distans (t.ex. löpband där klockan mäter fel).
-- Kör i Supabase → SQL Editor. Säkert att köra flera gånger.
alter table public.activities add column if not exists distance_override_m numeric(10,1)
  check (distance_override_m is null or distance_override_m between 100 and 300000);
comment on column public.activities.distance_override_m is
  'Rättad distans i meter. Används i stället för distance_m överallt; synken skriver aldrig över den.';
