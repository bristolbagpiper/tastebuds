create table if not exists public.restaurants (
  id bigint generated always as identity primary key,
  name text not null,
  subregion text not null check (subregion in ('Uptown', 'Midtown', 'Downtown')),
  neighbourhood text,
  cuisines text[] not null default '{}',
  venue_latitude double precision,
  venue_longitude double precision,
  venue_energy text check (venue_energy in ('Chill', 'Moderate', 'High')),
  venue_scene text[] not null default '{}',
  venue_crowd text[] not null default '{}',
  venue_music text[] not null default '{}',
  venue_setting text[] not null default '{}',
  venue_price text check (venue_price in ('$', '$$', '$$$', '$$$$')),
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists restaurants_name_idx
on public.restaurants (name asc);

create index if not exists restaurants_unarchived_name_idx
on public.restaurants (name asc)
where archived_at is null;

alter table public.restaurants enable row level security;

grant select on public.restaurants to authenticated;

drop policy if exists "Authenticated users can view restaurants" on public.restaurants;
create policy "Authenticated users can view restaurants"
on public.restaurants
for select
to authenticated
using (true);

insert into public.restaurants (
  name,
  subregion,
  neighbourhood,
  cuisines,
  venue_latitude,
  venue_longitude,
  venue_energy,
  venue_scene,
  venue_crowd,
  venue_music,
  venue_setting,
  venue_price,
  created_by
)
select
  source.restaurant_name,
  source.restaurant_subregion,
  source.restaurant_neighbourhood,
  source.restaurant_cuisines,
  source.venue_latitude,
  source.venue_longitude,
  source.venue_energy,
  source.venue_scene,
  source.venue_crowd,
  source.venue_music,
  source.venue_setting,
  source.venue_price,
  source.created_by
from (
  select
    restaurant_name,
    restaurant_subregion,
    restaurant_neighbourhood,
    restaurant_cuisines,
    venue_latitude,
    venue_longitude,
    venue_energy,
    venue_scene,
    venue_crowd,
    venue_music,
    venue_setting,
    venue_price,
    created_by,
    row_number() over (
      partition by
        lower(restaurant_name),
        coalesce(lower(restaurant_neighbourhood), ''),
        restaurant_subregion,
        coalesce(venue_latitude, 0),
        coalesce(venue_longitude, 0)
      order by id
    ) as dedupe_rank
  from public.events
) as source
where source.dedupe_rank = 1;

alter table public.events
add column if not exists restaurant_id bigint references public.restaurants(id);

create index if not exists events_restaurant_id_idx
on public.events (restaurant_id);

update public.events
set restaurant_id = restaurants.id
from public.restaurants
where public.events.restaurant_id is null
  and lower(public.events.restaurant_name) = lower(restaurants.name)
  and public.events.restaurant_subregion = restaurants.subregion
  and coalesce(lower(public.events.restaurant_neighbourhood), '') =
      coalesce(lower(restaurants.neighbourhood), '')
  and coalesce(public.events.venue_latitude, 0) = coalesce(restaurants.venue_latitude, 0)
  and coalesce(public.events.venue_longitude, 0) = coalesce(restaurants.venue_longitude, 0);
