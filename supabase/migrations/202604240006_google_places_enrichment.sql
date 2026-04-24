alter table public.restaurants
add column if not exists google_place_id text;

alter table public.restaurants
add column if not exists google_maps_uri text;

alter table public.restaurants
add column if not exists formatted_address text;

alter table public.restaurants
add column if not exists google_rating numeric(3,2);

alter table public.restaurants
add column if not exists google_user_ratings_total integer;

alter table public.restaurants
add column if not exists google_price_level text;

alter table public.restaurants
add column if not exists google_editorial_summary text;

alter table public.restaurants
add column if not exists google_phone_number text;

alter table public.restaurants
add column if not exists google_website_uri text;

create unique index if not exists restaurants_google_place_id_idx
on public.restaurants (google_place_id)
where google_place_id is not null;
