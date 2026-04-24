alter table public.events
add column if not exists archived_at timestamptz;

create index if not exists events_unarchived_starts_at_idx
on public.events (starts_at asc)
where archived_at is null;

