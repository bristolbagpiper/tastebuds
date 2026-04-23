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
check (type in ('event_signup', 'event_update', 'event_reminder'));
