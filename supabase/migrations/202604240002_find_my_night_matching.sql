alter table public.profiles
add column if not exists preferred_energy text[] not null default '{}';

alter table public.profiles
add column if not exists preferred_scene text[] not null default '{}';

alter table public.profiles
add column if not exists preferred_crowd text[] not null default '{}';

alter table public.profiles
add column if not exists preferred_music text[] not null default '{}';

alter table public.profiles
add column if not exists preferred_setting text[] not null default '{}';

alter table public.profiles
add column if not exists preferred_price text[] not null default '{}';

alter table public.events
add column if not exists venue_energy text check (venue_energy in ('Chill', 'Moderate', 'High'));

alter table public.events
add column if not exists venue_scene text[] not null default '{}';

alter table public.events
add column if not exists venue_crowd text[] not null default '{}';

alter table public.events
add column if not exists venue_music text[] not null default '{}';

alter table public.events
add column if not exists venue_setting text[] not null default '{}';

alter table public.events
add column if not exists venue_price text check (venue_price in ('$', '$$', '$$$', '$$$$'));

