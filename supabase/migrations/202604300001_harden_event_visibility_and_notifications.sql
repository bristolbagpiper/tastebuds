update public.event_signups
set status = 'cancelled',
    updated_at = timezone('utc', now())
where status = 'waitlisted';

delete from public.notifications
where type in ('event_waitlist', 'event_promoted');

alter table public.event_signups
drop constraint if exists event_signups_status_check;

alter table public.event_signups
add constraint event_signups_status_check
check (status in ('going', 'cancelled', 'removed', 'no_show', 'attended'));

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
    'event_attendance',
    'event_day_confirmation',
    'restaurant_removed'
  )
);

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

  if coalesce(v_existing_status, '') = 'going' then
    return query select true, 'going', null::text;
    return;
  end if;

  select count(*)
  into v_attendee_count
  from public.event_signups as es
  where es.event_id = p_event_id
    and es.status = 'going';

  if v_attendee_count >= v_event_capacity then
    return query select false, 'full', 'This table is full. Try a similar table instead.';
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
