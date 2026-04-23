alter table public.profiles
add column if not exists cuisine_preferences text[] not null default '{}';

create table if not exists public.events (
  id bigint generated always as identity primary key,
  title text not null,
  intent text not null check (intent in ('dating', 'friendship')),
  starts_at timestamptz not null,
  restaurant_name text not null,
  restaurant_subregion text not null check (restaurant_subregion in ('Uptown', 'Midtown', 'Downtown')),
  restaurant_neighbourhood text,
  restaurant_cuisines text[] not null default '{}',
  capacity integer not null default 12 check (capacity > 0 and capacity <= 200),
  description text,
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists events_upcoming_idx
on public.events (starts_at asc)
where status = 'open';

alter table public.events enable row level security;

grant select on public.events to authenticated;

drop policy if exists "Authenticated users can view events" on public.events;
create policy "Authenticated users can view events"
on public.events
for select
to authenticated
using (true);

create table if not exists public.event_signups (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going' check (status in ('going', 'cancelled')),
  restaurant_match_score integer not null default 0 check (restaurant_match_score >= 0 and restaurant_match_score <= 100),
  personal_match_score integer not null default 0 check (personal_match_score >= 0 and personal_match_score <= 100),
  personal_match_summary text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create index if not exists event_signups_event_status_idx
on public.event_signups (event_id, status);

create index if not exists event_signups_user_status_idx
on public.event_signups (user_id, status);

alter table public.event_signups enable row level security;

grant select, insert, update on public.event_signups to authenticated;

drop policy if exists "Users can view their own event signups" on public.event_signups;
create policy "Users can view their own event signups"
on public.event_signups
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own event signups" on public.event_signups;
create policy "Users can insert their own event signups"
on public.event_signups
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own event signups" on public.event_signups;
create policy "Users can update their own event signups"
on public.event_signups
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.notifications
add column if not exists event_id bigint references public.events(id) on delete cascade;

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'match_proposed',
    'match_accepted',
    'match_confirmed',
    'match_declined',
    'event_signup',
    'event_update',
    'event_reminder'
  )
);

alter table public.notifications
drop constraint if exists notifications_user_id_match_id_type_key;

create unique index if not exists notifications_match_unique_idx
on public.notifications (user_id, match_id, type)
where match_id is not null;

create unique index if not exists notifications_event_unique_idx
on public.notifications (user_id, event_id, type)
where event_id is not null;
