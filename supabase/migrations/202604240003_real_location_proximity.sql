alter table public.profiles
add column if not exists home_latitude double precision;

alter table public.profiles
add column if not exists home_longitude double precision;

alter table public.events
add column if not exists venue_latitude double precision;

alter table public.events
add column if not exists venue_longitude double precision;

