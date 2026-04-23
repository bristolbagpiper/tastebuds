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

create index if not exists notifications_email_pending_idx
on public.notifications (created_at)
where email_sent_at is null and email_status <> 'skipped';
