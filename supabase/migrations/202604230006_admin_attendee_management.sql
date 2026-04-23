alter table public.event_signups
drop constraint if exists event_signups_status_check;

alter table public.event_signups
add constraint event_signups_status_check
check (status in ('going', 'cancelled', 'removed', 'no_show'));
