-- Plats för väder och klädtips (stad eller ungefärlig position, avrundad till ~100 m).
alter table public.profile add column if not exists weather_place text check (weather_place is null or char_length(weather_place) <= 80);
alter table public.profile add column if not exists weather_lat numeric(6,3) check (weather_lat is null or weather_lat between -90 and 90);
alter table public.profile add column if not exists weather_lon numeric(6,3) check (weather_lon is null or weather_lon between -180 and 180);
