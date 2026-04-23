alter table public.events
add column if not exists minimum_viable_attendees integer;

update public.events
set minimum_viable_attendees = coalesce(minimum_viable_attendees, least(greatest(2, capacity / 2), capacity))
where minimum_viable_attendees is null;

alter table public.events
alter column minimum_viable_attendees set not null;

alter table public.events
alter column minimum_viable_attendees set default 2;

alter table public.events
drop constraint if exists events_minimum_viable_attendees_check;

alter table public.events
add constraint events_minimum_viable_attendees_check
check (minimum_viable_attendees >= 2 and minimum_viable_attendees <= capacity);

alter table public.event_signups
add column if not exists day_of_confirmation_status text;

update public.event_signups
set day_of_confirmation_status = coalesce(day_of_confirmation_status, 'pending')
where day_of_confirmation_status is null;

alter table public.event_signups
alter column day_of_confirmation_status set not null;

alter table public.event_signups
alter column day_of_confirmation_status set default 'pending';

alter table public.event_signups
add column if not exists day_of_confirmation_at timestamptz;

alter table public.event_signups
drop constraint if exists event_signups_day_of_confirmation_status_check;

alter table public.event_signups
add constraint event_signups_day_of_confirmation_status_check
check (day_of_confirmation_status in ('pending', 'confirmed', 'declined'));

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
