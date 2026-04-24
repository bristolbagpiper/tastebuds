create table if not exists public.saved_restaurants (
  id bigint generated always as identity primary key,
  restaurant_id bigint not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, user_id)
);

create index if not exists saved_restaurants_user_created_idx
on public.saved_restaurants (user_id, created_at desc);

create index if not exists saved_restaurants_restaurant_idx
on public.saved_restaurants (restaurant_id);

alter table public.saved_restaurants enable row level security;

grant select, insert, delete on public.saved_restaurants to authenticated;

drop policy if exists "Users can view their own saved restaurants" on public.saved_restaurants;
create policy "Users can view their own saved restaurants"
on public.saved_restaurants
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own saved restaurants" on public.saved_restaurants;
create policy "Users can insert their own saved restaurants"
on public.saved_restaurants
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own saved restaurants" on public.saved_restaurants;
create policy "Users can delete their own saved restaurants"
on public.saved_restaurants
for delete
using (auth.uid() = user_id);
