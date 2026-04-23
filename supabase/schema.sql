-- Source of truth lives in supabase/migrations/.
-- Keep this file as a convenience bootstrap mirror for manual SQL editor use.

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

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id bigint references public.matches(id) on delete cascade,
  type text not null check (
    type in (
      'match_proposed',
      'match_accepted',
      'match_confirmed',
      'match_declined'
    )
  ),
  title text not null,
  body text not null,
  read_at timestamptz,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  email_sent_at timestamptz,
  email_attempted_at timestamptz,
  email_error text,
  email_provider_id text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, match_id, type)
);

alter table public.notifications
add column if not exists email_status text not null default 'pending';

alter table public.notifications
add column if not exists email_sent_at timestamptz;

alter table public.notifications
add column if not exists email_attempted_at timestamptz;

alter table public.notifications
add column if not exists email_error text;

alter table public.notifications
add column if not exists email_provider_id text;

alter table public.notifications
drop constraint if exists notifications_email_status_check;

alter table public.notifications
add constraint notifications_email_status_check
check (email_status in ('pending', 'sent', 'failed', 'skipped'));

create index if not exists notifications_user_created_at_idx
on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
on public.notifications (user_id, created_at desc)
where read_at is null;

create index if not exists notifications_email_pending_idx
on public.notifications (created_at)
where email_sent_at is null and email_status <> 'skipped';

alter table public.notifications enable row level security;

grant select, update, delete on public.notifications to authenticated;

drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
on public.notifications
for select
using (auth.uid() = user_id);

drop policy if exists "Users can mark their own notifications read" on public.notifications;
create policy "Users can mark their own notifications read"
on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own notifications" on public.notifications;
create policy "Users can delete their own notifications"
on public.notifications
for delete
using (auth.uid() = user_id);

alter table public.profiles
add column if not exists cuisine_preferences text[] not null default '{}';

create table if not exists public.events (
  id bigint generated always as identity primary key,
  title text not null,
  intent text not null check (intent in ('dating', 'friendship')),
  starts_at timestamptz not null,
  duration_minutes integer not null default 120 check (duration_minutes >= 30 and duration_minutes <= 360),
  minimum_viable_attendees integer not null default 2 check (minimum_viable_attendees >= 2 and minimum_viable_attendees <= capacity),
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
  status text not null default 'going' check (status in ('going', 'cancelled', 'removed', 'no_show')),
  day_of_confirmation_status text not null default 'pending' check (day_of_confirmation_status in ('pending', 'confirmed', 'declined')),
  day_of_confirmation_at timestamptz,
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

alter table public.event_signups
drop constraint if exists event_signups_status_check;

alter table public.event_signups
add constraint event_signups_status_check
check (status in ('going', 'waitlisted', 'cancelled', 'removed', 'no_show', 'attended'));

alter table public.notifications
add column if not exists event_id bigint references public.events(id) on delete cascade;

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'event_signup',
    'event_update',
    'event_reminder_24h',
    'event_reminder_2h',
    'event_follow_up',
    'event_waitlist',
    'event_promoted',
    'event_attendance',
    'event_day_confirmation'
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

create or replace function public.join_event_signup_safe(
  p_event_id bigint,
  p_user_id uuid
)
returns table (
  ok boolean,
  status text,
  error text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_capacity integer;
  v_event_status text;
  v_existing_status text;
  v_attendee_count integer;
begin
  select e.capacity, e.status
  into v_event_capacity, v_event_status
  from public.events as e
  where e.id = p_event_id
  for update;

  if not found then
    return query select false, 'not_found', 'Event not found.';
    return;
  end if;

  if v_event_status <> 'open' then
    return query select false, 'closed', 'This event is not open for signups.';
    return;
  end if;

  select es.status
  into v_existing_status
  from public.event_signups as es
  where es.event_id = p_event_id
    and es.user_id = p_user_id
  for update;

  if coalesce(v_existing_status, '') in ('going', 'waitlisted') then
    return query select true, v_existing_status, null::text;
    return;
  end if;

  select count(*)
  into v_attendee_count
  from public.event_signups as es
  where es.event_id = p_event_id
    and es.status = 'going';

  if v_attendee_count >= v_event_capacity then
    insert into public.event_signups (
      day_of_confirmation_at,
      day_of_confirmation_status,
      event_id,
      status,
      updated_at,
      user_id
    )
    values (
      null,
      'pending',
      p_event_id,
      'waitlisted',
      timezone('utc', now()),
      p_user_id
    )
    on conflict (event_id, user_id)
    do update set
      day_of_confirmation_at = null,
      day_of_confirmation_status = 'pending',
      status = 'waitlisted',
      updated_at = excluded.updated_at;

    return query select true, 'waitlisted', null::text;
    return;
  end if;

  insert into public.event_signups (
    day_of_confirmation_at,
    day_of_confirmation_status,
    event_id,
    status,
    updated_at,
    user_id
  )
  values (
    null,
    'pending',
    p_event_id,
    'going',
    timezone('utc', now()),
    p_user_id
  )
  on conflict (event_id, user_id)
  do update set
    day_of_confirmation_at = null,
    day_of_confirmation_status = 'pending',
    status = 'going',
    updated_at = excluded.updated_at;

  return query select true, 'going', null::text;
end;
$$;

grant execute on function public.join_event_signup_safe(bigint, uuid)
to authenticated, service_role;

drop table if exists public.matches cascade;
drop table if exists public.match_rounds cascade;
drop table if exists public.availability cascade;

alter table public.notifications
drop constraint if exists notifications_match_id_fkey;

alter table public.notifications
drop column if exists match_id;

drop index if exists notifications_match_unique_idx;
drop index if exists notifications_event_unique_idx;

create unique index if not exists notifications_event_unique_idx
on public.notifications (user_id, event_id, type)
where event_id is not null;

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'event_signup',
    'event_update',
    'event_reminder_24h',
    'event_reminder_2h',
    'event_follow_up',
    'event_waitlist',
    'event_promoted',
    'event_attendance',
    'event_day_confirmation'
  )
);
