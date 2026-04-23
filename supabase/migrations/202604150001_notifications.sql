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
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, match_id, type)
);

create index if not exists notifications_user_created_at_idx
on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
on public.notifications (user_id, created_at desc)
where read_at is null;

alter table public.notifications enable row level security;

grant select, update on public.notifications to authenticated;

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
