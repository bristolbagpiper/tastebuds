-- Source of truth for the current database shape.
-- This file is intentionally idempotent so it can be applied to a project
-- that has already been patched manually in the Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  city text not null default 'New York City',
  region text not null default 'Manhattan',
  subregion text not null check (subregion in ('Uptown', 'Midtown', 'Downtown')),
  neighbourhood text,
  intent text not null check (intent in ('dating', 'friendship')),
  max_travel_minutes integer not null check (max_travel_minutes in (15, 30, 45)),
  bio text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create table if not exists public.availability (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  round_date date not null,
  intent text not null check (intent in ('dating', 'friendship')),
  available boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, round_date)
);

alter table public.availability
add column if not exists intent text;

update public.availability
set intent = coalesce(intent, 'dating')
where intent is null;

alter table public.availability
alter column intent set not null;

alter table public.availability
drop constraint if exists availability_intent_check;

alter table public.availability
add constraint availability_intent_check
check (intent in ('dating', 'friendship'));

alter table public.availability enable row level security;

grant select, insert, update on public.availability to authenticated;

drop policy if exists "Users can view their own availability" on public.availability;
create policy "Users can view their own availability"
on public.availability
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own availability" on public.availability;
create policy "Users can insert their own availability"
on public.availability
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own availability" on public.availability;
create policy "Users can update their own availability"
on public.availability
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.match_rounds (
  id bigint generated always as identity primary key,
  region text not null default 'Manhattan',
  round_date date not null,
  intent text not null check (intent in ('dating', 'friendship')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  participant_count integer not null default 0,
  match_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  unique (region, round_date, intent)
);

alter table public.match_rounds enable row level security;

grant select on public.match_rounds to authenticated;

drop policy if exists "Authenticated users can view match rounds" on public.match_rounds;
create policy "Authenticated users can view match rounds"
on public.match_rounds
for select
to authenticated
using (true);

create table if not exists public.matches (
  id bigint generated always as identity primary key,
  round_id bigint not null references public.match_rounds(id) on delete cascade,
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  intent text not null check (intent in ('dating', 'friendship')),
  score integer not null default 0,
  rationale text,
  status text not null default 'proposed' check (status in ('proposed', 'mutual', 'declined')),
  user_a_response text not null default 'pending' check (user_a_response in ('pending', 'accepted', 'declined')),
  user_b_response text not null default 'pending' check (user_b_response in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default timezone('utc', now()),
  check (user_a <> user_b)
);

alter table public.matches
add column if not exists user_a_response text;

alter table public.matches
add column if not exists user_b_response text;

update public.matches
set user_a_response = coalesce(user_a_response, 'pending'),
    user_b_response = coalesce(user_b_response, 'pending');

alter table public.matches
alter column user_a_response set not null;

alter table public.matches
alter column user_b_response set not null;

alter table public.matches
drop constraint if exists matches_status_check;

alter table public.matches
add constraint matches_status_check
check (status in ('proposed', 'mutual', 'declined'));

alter table public.matches
drop constraint if exists matches_user_a_response_check;

alter table public.matches
add constraint matches_user_a_response_check
check (user_a_response in ('pending', 'accepted', 'declined'));

alter table public.matches
drop constraint if exists matches_user_b_response_check;

alter table public.matches
add constraint matches_user_b_response_check
check (user_b_response in ('pending', 'accepted', 'declined'));

alter table public.matches enable row level security;

grant select on public.matches to authenticated;

drop policy if exists "Users can view their own matches" on public.matches;
create policy "Users can view their own matches"
on public.matches
for select
using (auth.uid() = user_a or auth.uid() = user_b);
