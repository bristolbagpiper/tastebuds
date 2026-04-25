alter table public.profiles
add column if not exists preferred_vibes text[] not null default '{}';

alter table public.profiles
add column if not exists drinking_preferences text[] not null default '{}';

alter table public.profiles
add column if not exists dietary_restrictions text[] not null default '{}';

alter table public.profiles
add column if not exists conversation_preference text[] not null default '{}';

alter table public.profiles
add column if not exists age_range_comfort text[] not null default '{}';

alter table public.profiles
add column if not exists group_size_comfort text[] not null default '{}';

alter table public.restaurants
add column if not exists google_open_now boolean,
add column if not exists google_opening_hours text[] not null default '{}',
add column if not exists google_good_for_groups boolean,
add column if not exists google_good_for_watching_sports boolean,
add column if not exists google_live_music boolean,
add column if not exists google_outdoor_seating boolean,
add column if not exists google_reservable boolean,
add column if not exists google_serves_beer boolean,
add column if not exists google_serves_brunch boolean,
add column if not exists google_serves_cocktails boolean,
add column if not exists google_serves_dessert boolean,
add column if not exists google_serves_dinner boolean,
add column if not exists google_serves_vegetarian_food boolean,
add column if not exists google_serves_wine boolean,
add column if not exists venue_noise_level text,
add column if not exists venue_seating_types text[] not null default '{}',
add column if not exists venue_formats text[] not null default '{}',
add column if not exists venue_indoor_outdoor text[] not null default '{}',
add column if not exists venue_reservation_friendly boolean,
add column if not exists venue_group_friendly boolean,
add column if not exists venue_good_for_conversation boolean,
add column if not exists venue_good_for_cocktails boolean,
add column if not exists venue_good_for_dinner boolean,
add column if not exists venue_good_for_casual_meetups boolean,
add column if not exists venue_vibes text[] not null default '{}',
add column if not exists menu_experience_tags text[] not null default '{}';

alter table public.restaurants
drop constraint if exists restaurants_venue_noise_level_check;

alter table public.restaurants
add constraint restaurants_venue_noise_level_check
check (venue_noise_level in ('Quiet', 'Moderate', 'Lively'));

update public.restaurants
set venue_group_friendly = coalesce(venue_group_friendly, google_good_for_groups),
    venue_reservation_friendly = coalesce(venue_reservation_friendly, google_reservable),
    venue_good_for_cocktails = coalesce(venue_good_for_cocktails, google_serves_cocktails),
    venue_good_for_dinner = coalesce(venue_good_for_dinner, google_serves_dinner)
where true;

alter table public.events
add column if not exists google_open_now boolean,
add column if not exists google_opening_hours text[] not null default '{}',
add column if not exists google_good_for_groups boolean,
add column if not exists google_good_for_watching_sports boolean,
add column if not exists google_live_music boolean,
add column if not exists google_outdoor_seating boolean,
add column if not exists google_reservable boolean,
add column if not exists google_serves_beer boolean,
add column if not exists google_serves_brunch boolean,
add column if not exists google_serves_cocktails boolean,
add column if not exists google_serves_dessert boolean,
add column if not exists google_serves_dinner boolean,
add column if not exists google_serves_vegetarian_food boolean,
add column if not exists google_serves_wine boolean,
add column if not exists venue_noise_level text,
add column if not exists venue_seating_types text[] not null default '{}',
add column if not exists venue_formats text[] not null default '{}',
add column if not exists venue_indoor_outdoor text[] not null default '{}',
add column if not exists venue_reservation_friendly boolean,
add column if not exists venue_group_friendly boolean,
add column if not exists venue_good_for_conversation boolean,
add column if not exists venue_good_for_cocktails boolean,
add column if not exists venue_good_for_dinner boolean,
add column if not exists venue_good_for_casual_meetups boolean,
add column if not exists venue_vibes text[] not null default '{}',
add column if not exists menu_experience_tags text[] not null default '{}';

alter table public.events
drop constraint if exists events_venue_noise_level_check;

alter table public.events
add constraint events_venue_noise_level_check
check (venue_noise_level in ('Quiet', 'Moderate', 'Lively'));

update public.events
set google_open_now = restaurants.google_open_now,
    google_opening_hours = restaurants.google_opening_hours,
    google_good_for_groups = restaurants.google_good_for_groups,
    google_good_for_watching_sports = restaurants.google_good_for_watching_sports,
    google_live_music = restaurants.google_live_music,
    google_outdoor_seating = restaurants.google_outdoor_seating,
    google_reservable = restaurants.google_reservable,
    google_serves_beer = restaurants.google_serves_beer,
    google_serves_brunch = restaurants.google_serves_brunch,
    google_serves_cocktails = restaurants.google_serves_cocktails,
    google_serves_dessert = restaurants.google_serves_dessert,
    google_serves_dinner = restaurants.google_serves_dinner,
    google_serves_vegetarian_food = restaurants.google_serves_vegetarian_food,
    google_serves_wine = restaurants.google_serves_wine,
    venue_noise_level = restaurants.venue_noise_level,
    venue_seating_types = restaurants.venue_seating_types,
    venue_formats = restaurants.venue_formats,
    venue_indoor_outdoor = restaurants.venue_indoor_outdoor,
    venue_reservation_friendly = coalesce(public.events.venue_reservation_friendly, restaurants.venue_reservation_friendly),
    venue_group_friendly = coalesce(public.events.venue_group_friendly, restaurants.venue_group_friendly),
    venue_good_for_conversation = restaurants.venue_good_for_conversation,
    venue_good_for_cocktails = coalesce(public.events.venue_good_for_cocktails, restaurants.venue_good_for_cocktails),
    venue_good_for_dinner = coalesce(public.events.venue_good_for_dinner, restaurants.venue_good_for_dinner),
    venue_good_for_casual_meetups = restaurants.venue_good_for_casual_meetups,
    venue_vibes = restaurants.venue_vibes,
    menu_experience_tags = restaurants.menu_experience_tags
from public.restaurants
where public.events.restaurant_id = restaurants.id;
