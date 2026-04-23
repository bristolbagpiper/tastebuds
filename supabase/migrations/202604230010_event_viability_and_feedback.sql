alter table public.events
add column if not exists viability_status text;

update public.events
set viability_status = coalesce(
  viability_status,
  case
    when status = 'cancelled' then 'cancelled_low_confirmations'
    else 'healthy'
  end
)
where viability_status is null;

alter table public.events
alter column viability_status set not null;

alter table public.events
alter column viability_status set default 'healthy';

alter table public.events
drop constraint if exists events_viability_status_check;

alter table public.events
add constraint events_viability_status_check
check (viability_status in ('healthy', 'at_risk', 'forced_go', 'cancelled_low_confirmations'));

create table if not exists public.event_feedback (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  venue_rating integer not null check (venue_rating between 1 and 5),
  group_rating integer not null check (group_rating between 1 and 5),
  would_join_again boolean not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, user_id)
);

create index if not exists event_feedback_event_idx
on public.event_feedback (event_id);

alter table public.event_feedback enable row level security;

grant select, insert, update on public.event_feedback to authenticated;

drop policy if exists "Users can view their own event feedback" on public.event_feedback;
create policy "Users can view their own event feedback"
on public.event_feedback
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their own event feedback" on public.event_feedback;
create policy "Users can insert their own event feedback"
on public.event_feedback
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their own event feedback" on public.event_feedback;
create policy "Users can update their own event feedback"
on public.event_feedback
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.notifications
drop constraint if exists notifications_type_check;

alter table public.notifications
add constraint notifications_type_check
check (
  type in (
    'event_signup',
    'event_update',
    'event_at_risk',
    'event_reminder_24h',
    'event_reminder_2h',
    'event_follow_up',
    'event_waitlist',
    'event_promoted',
    'event_attendance',
    'event_day_confirmation'
  )
);
